import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { ehViolacaoUnica, type Executor } from "./acao";
import { assertExameSeguido } from "./acesso";
import { CicloInvalidoError, cicloCumprido, distribuirCiclo, proximoDominio } from "./ciclo";
import { pesosEfetivos } from "./progresso";
import { taxasDeAcerto } from "@/lib/prontidao/servico";

/*
 * Ciclo de estudos (motor-de-estudo): o usuário escolhe o exame, os domínios e as horas;
 * a carga sai do peso do blueprint × desempenho (acerto recente nos simulados; sem
 * respostas no domínio, fator 1). O bloqueio Pro entra com entitlements.ts na etapa 7.
 */

/** Ciclo aberto com o exame e os domínios na ordem do exam guide. */
export async function cicloAtual(userId: string, x: Executor = db) {
  return x.studyCycle.findFirst({
    where: { userId, closedAt: null },
    include: {
      examVersion: { select: { id: true, code: true } },
      items: {
        include: { domain: { select: { id: true, code: true, nameEn: true, namePt: true, order: true } } },
        orderBy: { domain: { order: "asc" } },
      },
    },
  });
}

export type CicloAtual = NonNullable<Awaited<ReturnType<typeof cicloAtual>>>;

/** Distribuição sugerida para os domínios escolhidos (peso efetivo × fator de desempenho dos simulados). */
async function distribuicaoSugerida(
  x: Executor,
  userId: string,
  examVersionId: string,
  domainIds: string[],
  totalMin: number,
) {
  const dominios = await x.domain.findMany({
    where: { examVersionId, parentId: null, retiredAt: null },
    orderBy: { order: "asc" },
    select: { id: true, weights: { orderBy: { revision: "desc" }, take: 1, select: { weightPct: true } } },
  });
  const pesos = pesosEfetivos(dominios.map((d) => d.weights[0]?.weightPct?.toNumber() ?? null));
  const escolhidos = new Set(domainIds);
  const validos = dominios.flatMap((d, i) => (escolhidos.has(d.id) ? [{ domainId: d.id, peso: pesos[i]! }] : []));
  if (validos.length !== escolhidos.size)
    throw new AppError("Algum domínio escolhido não está disponível.", "validacao");
  const taxas = await taxasDeAcerto(x, userId, examVersionId);
  try {
    return distribuirCiclo(
      validos.map((d) => ({ ...d, taxaAcerto: taxas.get(d.domainId) ?? null })),
      totalMin,
    );
  } catch (e) {
    if (e instanceof CicloInvalidoError) throw new AppError(e.message, "validacao");
    throw e;
  }
}

/** Prévia da distribuição, sem gravar. */
export async function previaCiclo(userId: string, examVersionId: string, domainIds: string[], totalMin: number) {
  await assertExameSeguido(userId, examVersionId);
  return Object.fromEntries(await distribuicaoSugerida(db, userId, examVersionId, domainIds, totalMin));
}

/** Cria um ciclo (fecha o aberto, se houver). */
export async function criarCiclo(userId: string, examVersionId: string, domainIds: string[], totalMin: number) {
  await assertExameSeguido(userId, examVersionId);
  const dist = await distribuicaoSugerida(db, userId, examVersionId, domainIds, totalMin);
  try {
    await db.$transaction(async (tx) => {
      const agora = new Date();
      await tx.studyCycle.updateMany({ where: { userId, closedAt: null }, data: { closedAt: agora } });
      const ultimo = await tx.studyCycle.findFirst({
        where: { userId, examVersionId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      await tx.studyCycle.create({
        data: {
          userId,
          examVersionId,
          totalMin,
          number: (ultimo?.number ?? 0) + 1,
          startedAt: agora,
          items: { create: [...dist].map(([domainId, targetMin]) => ({ domainId, targetMin })) },
        },
      });
    });
  } catch (e) {
    if (ehViolacaoUnica(e)) throw new AppError("Outro ciclo acabou de ser criado. Recarregue a página.", "conflito");
    throw e;
  }
}

/** Encerra o ciclo aberto (todos, ou só o do exame informado). */
export async function encerrarCiclo(userId: string, examVersionId?: string, x: Executor = db) {
  await x.studyCycle.updateMany({
    where: { userId, closedAt: null, ...(examVersionId ? { examVersionId } : {}) },
    data: { closedAt: new Date() },
  });
}

/**
 * Recalcula o feito do ciclo aberto a partir das sessões encerradas registradas depois do
 * início dele (recalcular, em vez de somar deltas, não deixa o saldo divergir ao editar ou
 * excluir sessões). Quando todos os domínios cumprem a carga, fecha o ciclo e abre o próximo
 * com a distribuição recalculada.
 */
export async function recalcularCiclo(tx: Executor, userId: string): Promise<void> {
  const ciclo = await tx.studyCycle.findFirst({
    where: { userId, closedAt: null },
    include: { items: { select: { id: true, domainId: true, targetMin: true, doneMin: true } } },
  });
  if (!ciclo) return;
  const somas = await tx.studySession.groupBy({
    by: ["domainId"],
    where: {
      userId,
      examVersionId: ciclo.examVersionId,
      endedAt: { not: null },
      createdAt: { gte: ciclo.startedAt },
      domainId: { in: ciclo.items.map((i) => i.domainId) },
    },
    _sum: { durationSec: true },
  });
  const porDominio = new Map(somas.map((s) => [s.domainId, Math.floor((s._sum.durationSec ?? 0) / 60)]));
  const itens = ciclo.items.map((i) => ({ ...i, doneMin: porDominio.get(i.domainId) ?? 0 }));
  for (const i of itens) {
    const antes = ciclo.items.find((a) => a.id === i.id)!;
    if (antes.doneMin !== i.doneMin)
      await tx.studyCycleDomain.update({ where: { id: i.id }, data: { doneMin: i.doneMin } });
  }
  if (!cicloCumprido(itens)) return;

  const agora = new Date();
  await tx.studyCycle.update({ where: { id: ciclo.id }, data: { closedAt: agora } });
  let dist: Map<string, number>;
  try {
    dist = await distribuicaoSugerida(
      tx,
      userId,
      ciclo.examVersionId,
      itens.map((i) => i.domainId),
      ciclo.totalMin,
    );
  } catch {
    // Domínio saiu do exam guide: repete as cargas do ciclo anterior.
    dist = new Map(itens.map((i) => [i.domainId, i.targetMin]));
  }
  await tx.studyCycle.create({
    data: {
      userId,
      examVersionId: ciclo.examVersionId,
      totalMin: ciclo.totalMin,
      number: ciclo.number + 1,
      // 1 ms depois do fechamento: a sessão que fechou o ciclo não conta no próximo.
      startedAt: new Date(agora.getTime() + 1),
      items: { create: [...dist].map(([domainId, targetMin]) => ({ domainId, targetMin })) },
    },
  });
}

/** Próximo domínio sugerido pelo ciclo aberto: o de maior saldo pendente. */
export function proximoDoCiclo(ciclo: CicloAtual | null) {
  if (!ciclo) return null;
  const prox = proximoDominio(ciclo.items);
  if (!prox) return null;
  const item = ciclo.items.find((i) => i.domainId === prox.domainId)!;
  return {
    examVersionId: ciclo.examVersion.id,
    examCode: ciclo.examVersion.code,
    domainId: item.domainId,
    codigo: item.domain.code,
    nome: item.domain.namePt ?? item.domain.nameEn,
    pendenteMin: item.targetMin - item.doneMin,
  };
}
