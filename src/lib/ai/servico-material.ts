import "server-only";
import { createElement } from "react";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/auth/audit";
import { consumir, LIMITES } from "@/lib/auth/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { assertTopicoSeguido } from "@/lib/estudo/acesso";
import { EmailAlertaOrcamento } from "@/emails/ia/alerta-orcamento";
import { chamadaPadrao, iaDisponivel, IaIndisponivelError } from "./cliente";
import { gerarEGravarMaterial } from "./material";
import {
  fonteOrcamentoPrisma,
  OrcamentoEsgotadoError,
  verificarOrcamento,
  type EnviarAlertaOrcamento,
} from "./orcamento";
import { PROMPT_VERSION } from "./prompts/material-tarefa";
import { registrarUsoIA } from "./registro";

/*
 * Material com IA por tarefa no app. Toda entrada revalida que o usuário segue o exame da tarefa
 * (assertTopicoSeguido). O bloqueio por plano (Pro) entra com entitlements.ts na etapa 7; até lá
 * a geração é limitada por usuário (LIMITES.iaUsuario), pelo teto mensal e por ser feita uma vez só.
 */

export type MaterialDTO = {
  /** Todo o material daqui é gerado por IA: a tela mostra o selo "Gerado por IA". */
  geradoPorIA: true;
  geradoEm: Date;
  resumo: { id: string; texto: string; fontes: string[] };
  flashcards: { id: string; frente: string; verso: string }[];
};

export async function lerMaterial(topicId: string): Promise<MaterialDTO | null> {
  const s = await db.summary.findUnique({
    where: { topicId },
    select: { id: true, body: true, sources: true, published: true, createdAt: true },
  });
  if (!s?.published) return null;
  const flashcards = await db.flashcard.findMany({
    where: { topicId, published: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, front: true, back: true },
  });
  return {
    geradoPorIA: true,
    geradoEm: s.createdAt,
    resumo: { id: s.id, texto: s.body, fontes: s.sources },
    flashcards: flashcards.map((f) => ({ id: f.id, frente: f.front, verso: f.back })),
  };
}

/** Tarefa de um exame seguido, com os rótulos da tela. Lança "não encontrado" para as demais. */
export async function tarefaDoUsuario(userId: string, topicId: string) {
  await assertTopicoSeguido(userId, topicId);
  const t = await db.domain.findUniqueOrThrow({
    where: { id: topicId },
    select: {
      id: true,
      code: true,
      nameEn: true,
      namePt: true,
      examVersionId: true,
      examVersion: { select: { code: true } },
      parent: { select: { id: true, code: true, nameEn: true, namePt: true } },
    },
  });
  return {
    id: t.id,
    codigo: t.code,
    nome: t.namePt ?? t.nameEn,
    nomeEn: t.nameEn,
    exame: { id: t.examVersionId, codigo: t.examVersion.code },
    dominio: { id: t.parent!.id, codigo: t.parent!.code, nome: t.parent!.namePt ?? t.parent!.nameEn },
  };
}

export type EstadoGeracao =
  | { status: "pronto" }
  /** Outra requisição já está gerando esta tarefa. */
  | { status: "gerando" }
  | { status: "indisponivel"; motivo: "orcamento" | "limite" | "ia-desligada" | "erro"; mensagem: string };

const enviarAlertaApp: EnviarAlertaOrcamento = async ({ para, mes, gastoUsd, limiteUsd }) => {
  await sendEmail({
    to: para,
    subject: `Orçamento de IA de ${mes} atingido`,
    react: createElement(EmailAlertaOrcamento, { mes, gastoUsd, limiteUsd, appUrl: env().APP_URL }),
  });
};

/** Gera o material da tarefa se ainda não existe (uma vez, para todos). */
export async function gerarMaterial(userId: string, topicId: string): Promise<EstadoGeracao> {
  await assertTopicoSeguido(userId, topicId);
  if (await lerMaterial(topicId)) return { status: "pronto" };
  if (!iaDisponivel()) {
    return { status: "indisponivel", motivo: "ia-desligada", mensagem: new IaIndisponivelError().message };
  }
  if (!(await consumir(`ia:${userId}`, LIMITES.iaUsuario))) {
    return {
      status: "indisponivel",
      motivo: "limite",
      mensagem: "Você atingiu o limite de gerações por hora. Tente novamente mais tarde.",
    };
  }
  const fonte = fonteOrcamentoPrisma(db);
  const checarOrcamento = async () => {
    await verificarOrcamento({ fonte, enviarAlerta: enviarAlertaApp });
  };
  try {
    await checarOrcamento();
    const r = await gerarEGravarMaterial(
      {
        db,
        chamar: chamadaPadrao(),
        verificarOrcamento: checarOrcamento,
        aoUsar: async ({ model, usage }) => {
          await registrarUsoIA(db, { purpose: "material", model, usage, promptVersion: PROMPT_VERSION });
        },
      },
      topicId,
    );
    if (r.status === "ocupado") return { status: "gerando" };
    log("info", "ia.material.gerado", { topicId, questoes: r.questoes?.criadas ?? 0 });
    return { status: "pronto" };
  } catch (err) {
    if (err instanceof OrcamentoEsgotadoError)
      return { status: "indisponivel", motivo: "orcamento", mensagem: err.message };
    log("error", "ia.material.falhou", { topicId, erro: err instanceof Error ? err.message : String(err) });
    return {
      status: "indisponivel",
      motivo: "erro",
      mensagem: "Não foi possível gerar o material desta tarefa agora. Tente novamente mais tarde.",
    };
  }
}

/** Acima deste número de reports abertos na versão atual, o material sai do ar e é regerado no próximo pedido. */
export const LIMITE_REPORTS_ABERTOS = 3;

export const EntradaReport = z.object({
  topicId: z.string().min(1).max(64),
  contentType: z.enum(["summary", "flashcard"]),
  contentId: z.string().min(1).max(64),
  message: z.string().trim().min(5, "Descreva o erro em poucas palavras.").max(1000, "Use no máximo 1000 caracteres."),
});

/**
 * "Reportar erro": cria um ContentReport para a fila do admin. Com mais de 3 reports abertos
 * desde a última geração, despublica resumo e flashcards (os reports seguem abertos).
 */
export async function reportarErro(userId: string, input: z.input<typeof EntradaReport>) {
  const { topicId, contentType, contentId, message } = EntradaReport.parse(input);
  await assertTopicoSeguido(userId, topicId);
  if (!(await consumir(`report:${userId}`, LIMITES.reportUsuario))) {
    throw new AppError("Você enviou muitos reports em pouco tempo. Tente novamente mais tarde.", "limite");
  }
  const onde = { id: contentId, topicId, published: true };
  const existe =
    contentType === "summary" ? await db.summary.count({ where: onde }) : await db.flashcard.count({ where: onde });
  if (existe === 0) throw new AppError("Conteúdo não encontrado.", "nao_encontrado");

  await db.contentReport.create({ data: { userId, topicId, contentType, contentId, message } });

  const resumo = await db.summary.findUnique({ where: { topicId }, select: { published: true, createdAt: true } });
  const abertos = await db.contentReport.count({
    where: { topicId, resolvedAt: null, ...(resumo ? { createdAt: { gte: resumo.createdAt } } : {}) },
  });
  if (abertos <= LIMITE_REPORTS_ABERTOS || !resumo?.published) return { despublicado: false };

  await db.$transaction([
    db.summary.updateMany({ where: { topicId }, data: { published: false } }),
    db.flashcard.updateMany({ where: { topicId, published: true }, data: { published: false } }),
  ]);
  await audit("material.despublicado", null, { topicId, reports: abertos });
  return { despublicado: true };
}
