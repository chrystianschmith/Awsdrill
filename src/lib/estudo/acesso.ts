import "server-only";
import { db } from "@/lib/db";
import { VERSAO_VISIVEL } from "@/lib/catalogo/consultas";
import { AppError } from "@/lib/errors";

/**
 * Escopo do estudo: o usuário só estuda exames publicados que segue, e só domínios e
 * task statements vigentes desses exames. Toda escrita passa por aqui (IDOR).
 */

/** Exame publicado que o usuário pode passar a seguir. */
export async function assertExameDisponivel(examVersionId: string) {
  const v = await db.examVersion.findFirst({ where: { id: examVersionId, ...VERSAO_VISIVEL }, select: { id: true } });
  if (!v) throw new AppError("Exame não encontrado.", "nao_encontrado");
  return v;
}

export async function assertExameSeguido(userId: string, examVersionId: string) {
  const s = await db.userExam.findFirst({
    where: { userId, examVersionId, status: "ATIVO", examVersion: VERSAO_VISIVEL },
    select: { id: true },
  });
  if (!s) throw new AppError("Siga o exame antes de estudar.", "nao_encontrado");
  return s;
}

/** Domínio (pai) vigente de um exame seguido. */
export async function assertDominioDoExame(userId: string, examVersionId: string, domainId: string) {
  await assertExameSeguido(userId, examVersionId);
  const d = await db.domain.findFirst({
    where: { id: domainId, examVersionId, parentId: null, retiredAt: null },
    select: { id: true },
  });
  if (!d) throw new AppError("Domínio não encontrado.", "nao_encontrado");
  return d;
}

/** Task statement vigente de um domínio (e, portanto, de um exame) seguido. */
export async function assertTopicoDoDominio(domainId: string, topicId: string) {
  const t = await db.domain.findFirst({
    where: { id: topicId, parentId: domainId, retiredAt: null },
    select: { id: true },
  });
  if (!t) throw new AppError("Tarefa não encontrada.", "nao_encontrado");
  return t;
}

/** Task statement de qualquer exame seguido pelo usuário (para marcar status). */
export async function assertTopicoSeguido(userId: string, topicId: string) {
  const t = await db.domain.findFirst({
    where: {
      id: topicId,
      parentId: { not: null },
      retiredAt: null,
      examVersion: { ...VERSAO_VISIVEL, followers: { some: { userId, status: "ATIVO" } } },
    },
    select: { id: true },
  });
  if (!t) throw new AppError("Tarefa não encontrada.", "nao_encontrado");
  return t;
}
