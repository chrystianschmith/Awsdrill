import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { TopicStatus } from "@/generated/prisma/client";
import { assertExameDisponivel, assertTopicoSeguido } from "./acesso";
import { contaComoConcluido } from "./progresso";

/** Passa a seguir um exame publicado (idempotente). */
export async function seguirExame(userId: string, examVersionId: string) {
  await assertExameDisponivel(examVersionId);
  await db.userExam.upsert({
    where: { userId_examVersionId: { userId, examVersionId } },
    create: { userId, examVersionId },
    update: {},
  });
}

/** Deixa de seguir. Sessões e status das tarefas ficam guardados para quando voltar. */
export async function deixarDeSeguir(userId: string, examVersionId: string) {
  const r = await db.userExam.deleteMany({ where: { userId, examVersionId } });
  if (r.count === 0) throw new AppError("Você não segue este exame.", "nao_encontrado");
}

/** Data da prova (dia, 00:00 UTC) ou null para limpar. */
export async function definirDataProva(userId: string, examVersionId: string, data: Date | null) {
  const r = await db.userExam.updateMany({ where: { userId, examVersionId }, data: { examDate: data } });
  if (r.count === 0) throw new AppError("Você não segue este exame.", "nao_encontrado");
}

/**
 * Altera o status de uma task statement. A data de conclusão é a da primeira vez que
 * conclui; voltar para "não iniciado" a apaga. (A revisão espaçada entra na etapa 4b.)
 */
export async function definirStatusTopico(userId: string, topicId: string, status: TopicStatus) {
  await assertTopicoSeguido(userId, topicId);
  const agora = new Date();
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
  });
}
