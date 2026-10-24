import "server-only";
import { db } from "@/lib/db";
import { VERSAO_VISIVEL } from "@/lib/catalogo/consultas";
import { AppError } from "@/lib/errors";
import { assertEntitlement } from "@/lib/assinaturas/plano";
import type { Executor } from "./acao";
import { primeiraRevisao, proximaRevisao } from "./revisoes";
import { inicioDoDiaMais } from "./tempo";

/*
 * Revisão espaçada (motor-de-estudo): concluir uma task statement agenda +1 dia; boa avança
 * para +7 e +30, difícil volta para +1 e marca "Revisar". Só entram tarefas vigentes de
 * exames que o usuário segue. Recurso Pro (revisaoEspacada): sem ele, concluir não agenda e
 * registrar é recusado; as revisões guardadas voltam quando o plano volta.
 */

const tarefaVisivel = (userId: string) => ({
  retiredAt: null,
  examVersion: { ...VERSAO_VISIVEL, followers: { some: { userId, status: "ATIVO" as const } } },
});

const selecionarRevisao = {
  id: true,
  step: true,
  dueAt: true,
  topic: {
    select: {
      id: true,
      code: true,
      nameEn: true,
      namePt: true,
      parentId: true,
      examVersion: { select: { id: true, code: true } },
    },
  },
} as const;

/** Agenda a primeira revisão de uma tarefa recém-concluída (se não houver uma pendente). */
export async function agendarPrimeiraRevisao(tx: Executor, userId: string, topicId: string, agora: Date) {
  const pendente = await tx.review.findFirst({ where: { userId, topicId, doneAt: null }, select: { id: true } });
  if (!pendente) await tx.review.create({ data: { userId, topicId, ...primeiraRevisao(agora) } });
}

/** Tarefa voltou para "não iniciado": a revisão pendente deixa de fazer sentido. */
export async function cancelarRevisaoPendente(tx: Executor, userId: string, topicId: string) {
  await tx.review.deleteMany({ where: { userId, topicId, doneAt: null } });
}

/** Revisões vencidas (até agora), da mais atrasada para a mais recente. */
export async function revisoesVencidas(userId: string, agora = new Date(), take = 50) {
  return db.review.findMany({
    where: { userId, doneAt: null, dueAt: { lte: agora }, topic: tarefaVisivel(userId) },
    orderBy: { dueAt: "asc" },
    take,
    select: selecionarRevisao,
  });
}

/** Próximas revisões nos próximos `dias` dias (para o usuário se planejar). */
export async function proximasRevisoes(userId: string, agora = new Date(), dias = 7) {
  return db.review.findMany({
    where: {
      userId,
      doneAt: null,
      dueAt: { gt: agora, lt: inicioDoDiaMais(agora, dias + 1) },
      topic: tarefaVisivel(userId),
    },
    orderBy: { dueAt: "asc" },
    take: 50,
    select: selecionarRevisao,
  });
}

/** Registra uma revisão: boa avança, difícil volta para +1 dia e marca a tarefa como "Revisar". */
export async function registrarRevisao(userId: string, reviewId: string, boa: boolean) {
  await assertEntitlement(userId, "revisaoEspacada");
  const agora = new Date();
  await db.$transaction(async (tx) => {
    const r = await tx.review.findFirst({
      where: { id: reviewId, userId, doneAt: null, topic: tarefaVisivel(userId) },
      select: { id: true, step: true, topicId: true },
    });
    if (!r) throw new AppError("Revisão não encontrada.", "nao_encontrado");
    // Condicional em doneAt: duas confirmações simultâneas não agendam duas revisões.
    const feita = await tx.review.updateMany({
      where: { id: r.id, doneAt: null },
      data: { doneAt: agora, goodResult: boa },
    });
    if (feita.count === 0) throw new AppError("Revisão não encontrada.", "nao_encontrado");
    const prox = proximaRevisao(r.step, boa, agora);
    if (prox) await tx.review.create({ data: { userId, topicId: r.topicId, ...prox } });
    await tx.userTopic.upsert({
      where: { userId_topicId: { userId, topicId: r.topicId } },
      create: { userId, topicId: r.topicId, status: boa ? "CONCLUIDO" : "REVISAR", completedAt: agora },
      update: { status: boa ? "CONCLUIDO" : "REVISAR" },
    });
  });
}
