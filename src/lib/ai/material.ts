import type { PrismaClient } from "@/generated/prisma/client";
import { importarQuestoes, type ResultadoImportacao } from "@/lib/simulados/importacao";
import type { ChamadaMensagem } from "./cliente";
import { configIA } from "./config";
import { gerarValidado, ValidacaoIAError, type UsoChamada } from "./gerar-validado";
import { paramsMaterial, PROMPT_VERSION, type EntradaMaterial } from "./prompts/material-tarefa";
import { MaterialIA } from "./schemas";

/*
 * Material de uma tarefa (resumo, flashcards e questões), gerado uma única vez e compartilhado.
 * Sem "server-only" para rodar também em scripts; o app entra por servico.ts. As questões não
 * aparecem direto: entram no banco como pendentes, pelo mesmo import da etapa 5a, e só vão aos
 * simulados depois da moderação.
 */

export type DepsMaterial = {
  db: PrismaClient;
  chamar: ChamadaMensagem;
  /** Lança OrcamentoEsgotadoError quando o teto mensal foi atingido. */
  verificarOrcamento: () => Promise<void>;
  aoUsar: (uso: UsoChamada) => Promise<void>;
  /** Padrão: o modelo padrão da configuração, com o de reserva se o JSON não validar. */
  modelos?: { principal: string; reserva: string };
};

/** O que a IA recebe: só dados públicos do catálogo, nunca dado de usuário. */
export async function entradaDaTarefa(db: PrismaClient, topicId: string): Promise<EntradaMaterial | null> {
  const t = await db.domain.findFirst({
    where: { id: topicId, parentId: { not: null }, retiredAt: null },
    select: {
      code: true,
      nameEn: true,
      namePt: true,
      parent: {
        select: {
          code: true,
          nameEn: true,
          namePt: true,
          children: {
            where: { retiredAt: null, NOT: { id: topicId } },
            orderBy: { order: "asc" },
            select: { code: true, nameEn: true },
          },
        },
      },
      examVersion: { select: { code: true, sourceUrl: true, certification: { select: { name: true } } } },
    },
  });
  if (!t?.parent) return null;
  return {
    exame: { codigo: t.examVersion.code, nome: t.examVersion.certification.name },
    dominio: { codigo: t.parent.code, nome: t.parent.namePt ?? t.parent.nameEn },
    tarefa: { codigo: t.code, nomeEn: t.nameEn, nomePt: t.namePt },
    vizinhas: t.parent.children.map((c) => `${c.code} ${c.nameEn}`),
    guiaOficial: t.examVersion.sourceUrl,
  };
}

export type ResultadoGeracao = { status: "pronto"; questoes?: ResultadoImportacao } | { status: "ocupado" };

/**
 * Gera e grava o material da tarefa UMA vez. Um advisory lock do Postgres por tarefa impede geração
 * duplicada em chamadas simultâneas: quem não pega o lock recebe "ocupado" sem chamar a IA.
 */
export async function gerarEGravarMaterial(deps: DepsMaterial, topicId: string): Promise<ResultadoGeracao> {
  const { db } = deps;
  const entrada = await entradaDaTarefa(db, topicId);
  if (!entrada) throw new Error(`Tarefa ${topicId} não encontrada.`);
  const cfg = configIA();
  const modelos = deps.modelos ?? { principal: cfg.modeloPadrao, reserva: cfg.modeloFallback };

  return db.$transaction(
    async (tx): Promise<ResultadoGeracao> => {
      const [lock] = await tx.$queryRaw<
        { ok: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(hashtext(${`material-tarefa:${topicId}`})) AS ok`;
      if (!lock?.ok) return { status: "ocupado" };
      const atual = await tx.summary.findUnique({ where: { topicId }, select: { published: true } });
      if (atual?.published) return { status: "pronto" };

      const gerar = async (model: string, maxCorrecoes?: number) => {
        await deps.verificarOrcamento();
        return gerarValidado({
          chamar: deps.chamar,
          params: paramsMaterial(model, entrada),
          schema: MaterialIA,
          aoUsar: deps.aoUsar,
          maxCorrecoes,
        });
      };
      let gerado;
      try {
        gerado = await gerar(modelos.principal);
      } catch (err) {
        if (!(err instanceof ValidacaoIAError) || modelos.reserva === modelos.principal) throw err;
        gerado = await gerar(modelos.reserva, 1);
      }
      const { dados, model } = gerado;

      const resumo = {
        body: dados.resumo.texto,
        sources: [...new Set(dados.resumo.fontes)],
        model,
        promptVersion: PROMPT_VERSION,
        published: true,
      };
      await tx.summary.upsert({
        where: { topicId },
        create: { topicId, ...resumo },
        update: { ...resumo, createdAt: new Date() },
      });
      await tx.flashcard.createMany({
        data: dados.flashcards.map((f) => ({ topicId, front: f.frente, back: f.verso, promptVersion: PROMPT_VERSION })),
      });
      const questoes = await importarQuestoes(tx, {
        exame: entrada.exame.codigo,
        origem: "ia",
        versaoPrompt: PROMPT_VERSION,
        questoes: dados.questoes.map((q) => ({ ...q, dominio: entrada.tarefa.codigo })),
      });
      return { status: "pronto", questoes };
    },
    { timeout: 300_000, maxWait: 10_000 },
  );
}
