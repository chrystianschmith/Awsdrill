import "server-only";
import { db } from "@/lib/db";
import type { Executor } from "@/lib/estudo/acao";
import { pesosEfetivos } from "@/lib/estudo/progresso";
import {
  calcularProntidao,
  JANELA_DIAS,
  planoDeCorrecao,
  type ItemCorrecao,
  type ResultadoProntidao,
  taxaDeAcertoPorDominio,
} from "./calculo";

/*
 * Leitura e foto da prontidão. O cálculo é puro (calculo.ts); aqui só se busca o blueprint
 * vigente e as respostas do próprio usuário. A foto (ReadinessScore) é gravada ao encerrar
 * um simulado, para o histórico; a tela calcula na hora.
 */

const DIA_MS = 86_400_000;

/** Domínios vigentes com peso efetivo e tarefas vigentes, na ordem do exam guide. */
async function blueprintDoExame(x: Executor, examVersionId: string) {
  const dominios = await x.domain.findMany({
    where: { examVersionId, parentId: null, retiredAt: null },
    orderBy: { order: "asc" },
    select: {
      id: true,
      code: true,
      nameEn: true,
      namePt: true,
      weights: { orderBy: { revision: "desc" }, take: 1, select: { weightPct: true } },
      children: {
        where: { retiredAt: null },
        orderBy: { order: "asc" },
        select: { id: true, code: true, nameEn: true, namePt: true },
      },
    },
  });
  const pesos = pesosEfetivos(dominios.map((d) => d.weights[0]?.weightPct?.toNumber() ?? null));
  return dominios.map((d, i) => ({ ...d, peso: pesos[i]! }));
}

async function respostasRecentes(x: Executor, userId: string, domainIds: string[], agora: Date) {
  return x.answer.findMany({
    where: {
      userId,
      domainId: { in: domainIds },
      answeredAt: { gte: new Date(agora.getTime() - JANELA_DIAS * DIA_MS) },
    },
    select: { domainId: true, topicId: true, isCorrect: true, answeredAt: true },
  });
}

async function calcular(x: Executor, userId: string, examVersionId: string, agora: Date) {
  const blueprint = await blueprintDoExame(x, examVersionId);
  const respostas = await respostasRecentes(
    x,
    userId,
    blueprint.map((d) => d.id),
    agora,
  );
  const resultado = calcularProntidao(
    respostas,
    blueprint.map((d) => ({ id: d.id, peso: d.peso, tarefas: d.children.map((t) => t.id) })),
    agora,
  );
  return { blueprint, resultado };
}

export type ItemCorrecaoDTO = ItemCorrecao & { codigo: string; nome: string; dominio: string };

export type ProntidaoDTO = ResultadoProntidao & {
  examVersionId: string;
  rotulos: Record<string, { codigo: string; nome: string }>;
  plano: ItemCorrecaoDTO[];
  /** Fotos anteriores do exame (mais recente primeiro). */
  historico: { score: number; lowerBound: number; upperBound: number; computedAt: Date }[];
};

/** Prontidão atual do usuário em um exame, com o plano de correção e o histórico. */
export async function prontidaoDoExame(userId: string, examVersionId: string): Promise<ProntidaoDTO> {
  const { blueprint, resultado } = await calcular(db, userId, examVersionId, new Date());
  const rotulos: ProntidaoDTO["rotulos"] = {};
  for (const d of blueprint) {
    rotulos[d.id] = { codigo: d.code, nome: d.namePt ?? d.nameEn };
    for (const t of d.children) rotulos[t.id] = { codigo: t.code, nome: t.namePt ?? t.nameEn };
  }
  const historico = await db.readinessScore.findMany({
    where: { userId, examVersionId, domainId: null },
    orderBy: { computedAt: "desc" },
    take: 10,
    select: { score: true, lowerBound: true, upperBound: true, computedAt: true },
  });
  return {
    ...resultado,
    examVersionId,
    rotulos,
    historico,
    plano: planoDeCorrecao(resultado).map((p) => {
      const alvo = rotulos[p.topicId ?? p.domainId]!;
      return { ...p, codigo: alvo.codigo, nome: alvo.nome, dominio: rotulos[p.domainId]!.codigo };
    }),
  };
}

/** Grava a foto da prontidão do exame e de cada domínio (ao encerrar um simulado). */
export async function gravarProntidao(tx: Executor, userId: string, examVersionId: string, agora: Date) {
  const { resultado: r } = await calcular(tx, userId, examVersionId, agora);
  const base = { userId, examVersionId, methodologyVersion: r.methodologyVersion, computedAt: agora };
  await tx.readinessScore.createMany({
    data: [
      {
        ...base,
        domainId: null,
        score: r.score,
        lowerBound: r.lowerBound,
        upperBound: r.upperBound,
        coverage: r.coverage,
        sampleSize: r.sampleSize,
      },
      ...r.dominios.map((d) => ({
        ...base,
        domainId: d.domainId,
        score: d.score,
        lowerBound: d.lowerBound,
        upperBound: d.upperBound,
        coverage: d.coverage,
        sampleSize: d.sampleSize,
      })),
    ],
  });
}

/** Taxa de acerto recente por domínio do exame (fator de desempenho do ciclo). */
export async function taxasDeAcerto(x: Executor, userId: string, examVersionId: string, agora = new Date()) {
  const dominios = await x.domain.findMany({
    where: { examVersionId, parentId: null, retiredAt: null },
    select: { id: true },
  });
  const respostas = await respostasRecentes(
    x,
    userId,
    dominios.map((d) => d.id),
    agora,
  );
  return taxaDeAcertoPorDominio(respostas, agora);
}
