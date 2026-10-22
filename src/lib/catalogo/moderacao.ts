import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { DiffExame } from "./diff";
import { aplicarExame, type ResultadoAplicacao } from "./publicacao";
import { ExameColetado } from "./schemas";

/**
 * Fila de moderação do catálogo: coletas que mudaram o exame sem confiança para publicar sozinhas.
 * A tela de admin entra na etapa 8; até lá, aprovar e rejeitar rodam pela pipeline (workflow_dispatch).
 */

export function hashPayload(exame: ExameColetado): string {
  // lidoEm muda todo mês e não muda o conteúdo: fora do hash, para a mesma coleta não reentrar na fila.
  return createHash("sha256").update(JSON.stringify({ ...exame, lidoEm: null })).digest("hex");
}

/**
 * Põe a coleta na fila. A mesma coleta pendente não entra duas vezes; uma coleta nova do mesmo
 * exame substitui as pendentes anteriores, porque só a mais recente reflete o guia.
 */
export async function enfileirarRevisao(
  db: PrismaClient,
  dados: { runId: string | null; exame: ExameColetado; diff: DiffExame; confianca: number; problemas: string[] },
): Promise<{ id: string; nova: boolean }> {
  const payloadHash = hashPayload(dados.exame);
  return db.$transaction(async (tx) => {
    const existente = await tx.catalogReview.findUnique({
      where: { examCode_payloadHash: { examCode: dados.exame.codigo, payloadHash } },
      select: { id: true, status: true },
    });
    // Já decidida (aprovada ou rejeitada) ou ainda pendente: não reabre.
    if (existente) return { id: existente.id, nova: false };
    await tx.catalogReview.updateMany({
      where: { examCode: dados.exame.codigo, status: "PENDING" },
      data: { status: "SUPERSEDED", decidedAt: new Date() },
    });
    const criada = await tx.catalogReview.create({
      data: {
        runId: dados.runId,
        examCode: dados.exame.codigo,
        payload: dados.exame as unknown as Prisma.InputJsonValue,
        payloadHash,
        diff: dados.diff as unknown as Prisma.InputJsonValue,
        confidence: new Prisma.Decimal(dados.confianca),
        problems: dados.problemas,
      },
      select: { id: true },
    });
    return { id: criada.id, nova: true };
  });
}

async function pendente(db: PrismaClient, id: string) {
  const r = await db.catalogReview.findUnique({ where: { id }, select: { id: true, status: true, payload: true } });
  if (!r) throw new Error(`Revisão ${id} não encontrada.`);
  if (r.status !== "PENDING") throw new Error(`Revisão ${id} já está ${r.status}.`);
  return r;
}

/** Aprova: grava a coleta pelo mesmo caminho da publicação automática. */
export async function aprovarRevisao(db: PrismaClient, id: string): Promise<ResultadoAplicacao> {
  const r = await pendente(db, id);
  const resultado = await aplicarExame(db, ExameColetado.parse(r.payload));
  await db.catalogReview.update({ where: { id }, data: { status: "APPROVED", decidedAt: new Date() } });
  return resultado;
}

/** Rejeita: o catálogo fica como está e a mesma coleta não volta para a fila. */
export async function rejeitarRevisao(db: PrismaClient, id: string): Promise<void> {
  await pendente(db, id);
  await db.catalogReview.update({ where: { id }, data: { status: "REJECTED", decidedAt: new Date() } });
}
