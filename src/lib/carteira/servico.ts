import "server-only";
import { createElement } from "react";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { sendEmail } from "@/lib/email/send";
import { getDayKey } from "@/lib/estudo/tempo";
import LembreteRecertificacaoEmail, {
  assuntoLembreteRecertificacao,
  type ItemLembrete,
} from "@/emails/carteira/lembrete-recertificacao";
import { calcularVencimento, diasParaVencer, lembreteDevido, situacao } from "./regras";

const DIA = 24 * 60 * 60 * 1000;
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

export const EntradaCertificacao = z
  .object({
    certificationId: z.string().min(1).max(64),
    examCode: z
      .string()
      .trim()
      .max(20)
      .transform((v) => v || null)
      .nullish(),
    result: z.enum(["PASSED", "FAILED"]),
    examDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data válida.")
      .transform((v) => new Date(`${v}T00:00:00Z`))
      .refine((d) => !Number.isNaN(d.getTime()), "Use uma data válida."),
    scaledScore: z.coerce
      .number()
      .int()
      .min(100, "A nota vai de 100 a 1000.")
      .max(1000, "A nota vai de 100 a 1000.")
      .nullish(),
    badgeUrl: z
      .string()
      .trim()
      .max(500)
      .transform((v) => v || null)
      .nullish()
      .refine((v) => !v || /^https:\/\/[^\s]+$/.test(v), "O link do badge precisa começar com https://."),
  })
  .strict();

export type EntradaCertificacaoInput = z.input<typeof EntradaCertificacao>;

/** Certificações do catálogo, com as versões publicadas, para o formulário. */
export async function certificacoesParaEscolher() {
  const certs = await db.certification.findMany({
    orderBy: [{ level: "asc" }, { trackOrder: "asc" }],
    select: {
      id: true,
      name: true,
      versions: { where: { publishState: "PUBLISHED" }, orderBy: { code: "asc" }, select: { code: true } },
    },
  });
  return certs.map((c) => ({ id: c.id, nome: c.name, codigos: c.versions.map((v) => v.code) }));
}

/** Valida a entrada contra o catálogo e calcula o vencimento. */
async function preparar(input: EntradaCertificacaoInput, agora: Date) {
  const dados = EntradaCertificacao.parse(input);
  // examDate é o dia (00:00 UTC); "hoje" é o dia em São Paulo.
  if (dados.examDate.toISOString().slice(0, 10) > getDayKey(agora))
    throw new AppError("A data do exame não pode estar no futuro.", "validacao");
  const cert = await db.certification.findUnique({
    where: { id: dados.certificationId },
    select: { versions: { orderBy: { createdAt: "desc" }, select: { code: true, validityMonths: true } } },
  });
  if (!cert) throw new AppError("Certificação não encontrada.", "nao_encontrado");
  const versao = dados.examCode ? cert.versions.find((v) => v.code === dados.examCode) : cert.versions[0];
  if (dados.examCode && !versao) throw new AppError("Esse código de exame não é desta certificação.", "validacao");
  const validade = versao?.validityMonths ?? 36;
  return {
    ...dados,
    examCode: dados.examCode ?? null,
    scaledScore: dados.scaledScore ?? null,
    badgeUrl: dados.badgeUrl ?? null,
    expiresAt: dados.result === "PASSED" ? calcularVencimento(dados.examDate, validade) : null,
  };
}

export async function listarCarteira(userId: string, agora = new Date()) {
  const itens = await db.userCertification.findMany({
    where: { userId },
    orderBy: [{ examDate: "desc" }],
    select: {
      id: true,
      certificationId: true,
      examCode: true,
      result: true,
      examDate: true,
      scaledScore: true,
      expiresAt: true,
      badgeUrl: true,
      certification: { select: { name: true, level: true } },
    },
  });
  return itens.map((i) => ({
    ...i,
    situacao: situacao(i, agora),
    diasParaVencer: i.expiresAt ? diasParaVencer(i.expiresAt, agora) : null,
  }));
}

export async function adicionarCertificacao(userId: string, input: EntradaCertificacaoInput, agora = new Date()) {
  const dados = await preparar(input, agora);
  const total = await db.userCertification.count({ where: { userId } });
  if (total >= 100) throw new AppError("Limite de 100 registros na carteira.", "limite");
  return db.userCertification.create({ data: { userId, ...dados }, select: { id: true } });
}

export async function editarCertificacao(
  userId: string,
  id: string,
  input: EntradaCertificacaoInput,
  agora = new Date(),
) {
  const dados = await preparar(input, agora);
  const atual = await db.userCertification.findFirst({ where: { id, userId }, select: { expiresAt: true } });
  if (!atual) throw new AppError("Registro não encontrado.", "nao_encontrado");
  const mudouVencimento = atual.expiresAt?.getTime() !== dados.expiresAt?.getTime();
  await db.userCertification.update({
    where: { id },
    data: { ...dados, ...(mudouVencimento ? { reminderStage: null } : {}) },
  });
}

export async function excluirCertificacao(userId: string, id: string) {
  const r = await db.userCertification.deleteMany({ where: { id, userId } });
  if (r.count === 0) throw new AppError("Registro não encontrado.", "nao_encontrado");
}

/**
 * Cron diário: um único e-mail por usuário com as certificações que chegaram a um estágio de
 * lembrete (180, 90, 30, 7 dias e no vencimento). Respeita a preferência "recertificação".
 */
export async function enviarLembretesRecertificacao(
  agora = new Date(),
): Promise<{ emails: number; certificacoes: number }> {
  const candidatas = await db.userCertification.findMany({
    where: {
      result: "PASSED",
      expiresAt: { gte: new Date(agora.getTime() - 31 * DIA), lte: new Date(agora.getTime() + 181 * DIA) },
      user: { deletedAt: null, notificationPreference: { is: { recertificacao: true } } },
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      reminderStage: true,
      certification: { select: { name: true } },
      user: { select: { email: true, name: true } },
    },
  });

  const porUsuario = new Map<
    string,
    { email: string; nome: string; itens: ItemLembrete[]; envios: { id: string; estagio: number }[] }
  >();
  for (const c of candidatas) {
    if (!c.expiresAt) continue;
    const estagio = lembreteDevido(c.expiresAt, agora, c.reminderStage);
    if (estagio === null) continue;
    const grupo = porUsuario.get(c.userId) ?? {
      email: c.user.email,
      nome: c.user.name.split(" ")[0] || c.user.name,
      itens: [],
      envios: [],
    };
    grupo.itens.push({
      nome: c.certification.name,
      vence: fmtData.format(c.expiresAt),
      dias: diasParaVencer(c.expiresAt, agora),
    });
    grupo.envios.push({ id: c.id, estagio });
    porUsuario.set(c.userId, grupo);
  }

  let emails = 0;
  let certificacoes = 0;
  const appUrl = env().APP_URL;
  for (const g of porUsuario.values()) {
    try {
      await sendEmail({
        to: g.email,
        subject: assuntoLembreteRecertificacao,
        react: createElement(LembreteRecertificacaoEmail, { nome: g.nome, itens: g.itens, appUrl }),
      });
    } catch (e) {
      log("error", "carteira.lembrete_falhou", { erro: e instanceof Error ? e.message : String(e) });
      continue;
    }
    // Grava o estágio só depois de enviar: falha hoje tenta de novo amanhã.
    for (const e of g.envios)
      await db.userCertification.update({ where: { id: e.id }, data: { reminderStage: e.estagio } });
    emails++;
    certificacoes += g.envios.length;
  }
  return { emails, certificacoes };
}
