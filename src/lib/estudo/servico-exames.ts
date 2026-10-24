import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { UpgradeRequiredError } from "@/lib/assinaturas/entitlements";
import { limiteDoPlano, temRecurso } from "@/lib/assinaturas/plano";
import type { TopicStatus } from "@/generated/prisma/client";
import { assertExameDisponivel, assertTopicoSeguido } from "./acesso";
import { contaComoConcluido } from "./progresso";
import { encerrarCiclo } from "./servico-ciclo";
import { agendarPrimeiraRevisao, cancelarRevisaoPendente } from "./servico-revisoes";

/**
 * Passa a seguir um exame publicado (idempotente) ou retoma um pausado. O limite do plano
 * é contado dentro da transação, com trava por usuário, para duas abas não passarem juntas.
 */
export async function seguirExame(userId: string, examVersionId: string) {
  await assertExameDisponivel(examVersionId);
  const limite = await limiteDoPlano(userId, "maxExamesSeguidos");
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`seguir-exame:${userId}`}))`;
    const atual = await tx.userExam.findUnique({
      where: { userId_examVersionId: { userId, examVersionId } },
      select: { status: true },
    });
    if (atual?.status === "ATIVO") return;
    const ativos = await tx.userExam.count({ where: { userId, status: "ATIVO" } });
    if (ativos >= limite)
      throw new UpgradeRequiredError(
        "maxExamesSeguidos",
        `No plano Grátis você segue ${limite} exame por vez. Assine o Pro para seguir mais.`,
      );
    await tx.userExam.upsert({
      where: { userId_examVersionId: { userId, examVersionId } },
      create: { userId, examVersionId },
      update: { status: "ATIVO" },
    });
  });
}

/**
 * Deixa de seguir. Sessões, status das tarefas e revisões ficam guardados para quando voltar
 * (as revisões só somem da lista); o ciclo aberto desse exame é encerrado.
 */
export async function deixarDeSeguir(userId: string, examVersionId: string) {
  await db.$transaction(async (tx) => {
    const r = await tx.userExam.deleteMany({ where: { userId, examVersionId } });
    if (r.count === 0) throw new AppError("Você não segue este exame.", "nao_encontrado");
    await encerrarCiclo(userId, examVersionId, tx);
  });
}

/** Data da prova (dia, 00:00 UTC) ou null para limpar. */
export async function definirDataProva(userId: string, examVersionId: string, data: Date | null) {
  const r = await db.userExam.updateMany({ where: { userId, examVersionId }, data: { examDate: data } });
  if (r.count === 0) throw new AppError("Você não segue este exame.", "nao_encontrado");
}

/**
 * Altera o status de uma task statement. A data de conclusão é a da primeira vez que
 * conclui, e concluir agenda a primeira revisão (+1 dia); voltar para "não iniciado"
 * apaga a data e a revisão pendente.
 */
export async function definirStatusTopico(userId: string, topicId: string, status: TopicStatus) {
  await assertTopicoSeguido(userId, topicId);
  const agora = new Date();
  const revisa = await temRecurso(userId, "revisaoEspacada");
  await db.$transaction(async (tx) => {
    const atual = await tx.userTopic.findUnique({
      where: { userId_topicId: { userId, topicId } },
      select: { status: true },
    });
    const concluindo = status === "CONCLUIDO" && !contaComoConcluido(atual?.status ?? "NAO_INICIADO");
    await tx.userTopic.upsert({
      where: { userId_topicId: { userId, topicId } },
      create: { userId, topicId, status, completedAt: status === "CONCLUIDO" ? agora : null },
      update: {
        status,
        ...(concluindo ? { completedAt: agora } : {}),
        ...(status === "NAO_INICIADO" ? { completedAt: null } : {}),
      },
    });
    if (concluindo && revisa) await agendarPrimeiraRevisao(tx, userId, topicId, agora);
    if (status === "NAO_INICIADO") await cancelarRevisaoPendente(tx, userId, topicId);
  });
}
