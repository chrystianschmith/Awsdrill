import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { AttemptMode, AttemptStatus } from "@/generated/prisma/client";
import { ehViolacaoUnica, type Executor } from "@/lib/estudo/acao";
import { assertExameSeguido } from "@/lib/estudo/acesso";
import { pesosEfetivos } from "@/lib/estudo/progresso";
import { gravarProntidao } from "@/lib/prontidao/servico";
import {
  corrigir,
  dentroDoPrazo,
  prazoDaProva,
  relatorioPorDominio,
  selecaoValida,
  sortearQuestoes,
  tempoDeResposta,
} from "./regras";
import { Alternativas, type Alternativa } from "./schemas";

/*
 * Simulados (etapa 5). Regras de confiança (seguranca-vibecoding §8): o sorteio, o prazo,
 * a correção e o tempo de resposta são do servidor; o gabarito e a explicação só saem
 * depois da resposta (treino) ou do envio (prova). O bloqueio Pro do modo prova entra
 * com entitlements.ts na etapa 7.
 */

const PADRAO_PROVA = 65;

/** Bloqueia a linha do simulado: serializa respostas e envio. */
async function travar(tx: Executor, attemptId: string) {
  await tx.$queryRaw`SELECT id FROM "MockAttempt" WHERE id = ${attemptId} FOR UPDATE`;
}

/** Questões publicadas do exame, por domínio vigente (para o sorteio e para a tela de início). */
export async function bancoDoExame(examVersionId: string, x: Executor = db) {
  const dominios = await x.domain.findMany({
    where: { examVersionId, parentId: null, retiredAt: null },
    orderBy: { order: "asc" },
    select: {
      id: true,
      code: true,
      nameEn: true,
      namePt: true,
      weights: { orderBy: { revision: "desc" }, take: 1, select: { weightPct: true } },
      _count: { select: { questions: { where: { publishState: "PUBLISHED" } } } },
    },
  });
  const pesos = pesosEfetivos(dominios.map((d) => d.weights[0]?.weightPct?.toNumber() ?? null));
  return dominios.map((d, i) => ({
    id: d.id,
    codigo: d.code,
    nome: d.namePt ?? d.nameEn,
    peso: pesos[i]!,
    questoes: d._count.questions,
  }));
}

export type InicioSimulado = {
  examVersionId: string;
  mode: AttemptMode;
  /** Só treino: quantidade e domínios (vazio = exame inteiro). */
  quantidade?: number;
  domainIds?: string[];
};

/** Começa um simulado; um em andamento por usuário (o anterior é encerrado com o que foi respondido). */
export async function iniciarSimulado(userId: string, input: InicioSimulado): Promise<{ id: string }> {
  await assertExameSeguido(userId, input.examVersionId);
  const exame = await db.examVersion.findUniqueOrThrow({
    where: { id: input.examVersionId },
    select: { questionCount: true, durationMinutes: true },
  });
  const banco = await bancoDoExame(input.examVersionId);
  const filtro = input.mode === "TREINO" ? (input.domainIds ?? []) : [];
  if (filtro.some((id) => !banco.some((d) => d.id === id)))
    throw new AppError("Algum domínio escolhido não está disponível.", "validacao");
  const dominios = filtro.length > 0 ? banco.filter((d) => filtro.includes(d.id)) : banco;

  let n: number;
  let deadlineAt: Date | null = null;
  const agora = new Date();
  if (input.mode === "PROVA") {
    if (!exame.durationMinutes)
      throw new AppError("A duração oficial desta prova ainda está a confirmar. Use o modo treino.", "validacao");
    n = exame.questionCount ?? PADRAO_PROVA;
    deadlineAt = prazoDaProva(agora, exame.durationMinutes);
  } else {
    n = input.quantidade ?? 10;
  }

  const questoes = await db.question.findMany({
    where: {
      examVersionId: input.examVersionId,
      publishState: "PUBLISHED",
      domainId: { in: dominios.map((d) => d.id) },
    },
    select: { id: true, domainId: true, answers: { where: { userId }, select: { id: true }, take: 1 } },
  });
  if (questoes.length === 0)
    throw new AppError("Ainda não há questões publicadas para este exame. Volte em breve.", "sem_questoes");
  const ids = sortearQuestoes(
    questoes.map((q) => ({ id: q.id, domainId: q.domainId, vista: q.answers.length > 0 })),
    new Map(dominios.map((d) => [d.id, d.peso])),
    n,
  );

  try {
    return await db.$transaction(async (tx) => {
      const aberto = await tx.mockAttempt.findFirst({
        where: { userId, status: "IN_PROGRESS" },
        select: { id: true },
      });
      if (aberto) await finalizarTx(tx, aberto.id, "SUBMITTED", agora);
      return tx.mockAttempt.create({
        data: {
          userId,
          examVersionId: input.examVersionId,
          mode: input.mode,
          domainFilter: filtro,
          questionIds: ids,
          startedAt: agora,
          deadlineAt,
        },
        select: { id: true },
      });
    });
  } catch (e) {
    if (ehViolacaoUnica(e)) throw new AppError("Outro simulado acabou de começar. Recarregue a página.", "conflito");
    throw e;
  }
}

/** Corrige o que foi respondido e grava o relatório por domínio. Idempotente. */
async function finalizarTx(tx: Executor, attemptId: string, status: AttemptStatus, agora: Date) {
  await travar(tx, attemptId);
  const a = await tx.mockAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: {
      status: true,
      userId: true,
      examVersionId: true,
      questionIds: true,
      answers: { select: { questionId: true, isCorrect: true } },
    },
  });
  if (a.status !== "IN_PROGRESS") return;
  const questoes = await tx.question.findMany({
    where: { id: { in: a.questionIds } },
    select: { id: true, domainId: true, domain: { select: { code: true, nameEn: true, namePt: true } } },
  });
  const r = relatorioPorDominio(questoes, a.answers);
  const rotulos = new Map(questoes.map((q) => [q.domainId, q.domain]));
  await tx.mockAttempt.update({
    where: { id: attemptId },
    data: {
      status,
      submittedAt: agora,
      correctCount: r.corretas,
      domainReport: r.dominios
        .map((l) => {
          const d = rotulos.get(l.domainId)!;
          return { ...l, codigo: d.code, nome: d.namePt ?? d.nameEn };
        })
        .sort((x, y) => Number(x.codigo) - Number(y.codigo)),
    },
  });
  await gravarProntidao(tx, a.userId, a.examVersionId, agora);
}

/** Simulado do próprio usuário; o de outro usuário é "não encontrado" (IDOR). */
async function simuladoDoUsuario(x: Executor, userId: string, attemptId: string) {
  const a = await x.mockAttempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      mode: true,
      status: true,
      startedAt: true,
      deadlineAt: true,
      questionIds: true,
      examVersion: { select: { code: true } },
    },
  });
  if (!a) throw new AppError("Simulado não encontrado.", "nao_encontrado");
  return a;
}

/** Prova cujo prazo passou é encerrada como expirada ao ser lida ou respondida. */
async function expirarSeVenceu(userId: string, attemptId: string, agora: Date) {
  const a = await simuladoDoUsuario(db, userId, attemptId);
  if (a.status === "IN_PROGRESS" && !dentroDoPrazo(a.deadlineAt, agora)) {
    await db.$transaction((tx) => finalizarTx(tx, attemptId, "EXPIRED", agora));
    return true;
  }
  return false;
}

export type Feedback = {
  isCorrect: boolean;
  correctKeys: string[];
  explanation: string;
  docUrls: string[];
};

export type QuestaoDTO = {
  id: string;
  stem: string;
  options: Alternativa[];
  quantasCorretas: number;
  dominio: string;
  selecionadas: string[] | null;
  /** Só depois da resposta (treino) ou do envio (prova). */
  feedback: Feedback | null;
};

export type SimuladoDTO = {
  id: string;
  mode: AttemptMode;
  status: AttemptStatus;
  examCode: string;
  deadlineAt: string | null;
  serverNow: string;
  questoes: QuestaoDTO[];
};

/** Estado do simulado para a tela, sem gabarito do que ainda não pode ser revelado. */
export async function obterSimulado(userId: string, attemptId: string): Promise<SimuladoDTO> {
  const agora = new Date();
  await expirarSeVenceu(userId, attemptId, agora);
  const a = await simuladoDoUsuario(db, userId, attemptId);
  const [questoes, respostas] = await Promise.all([
    db.question.findMany({
      where: { id: { in: a.questionIds } },
      select: {
        id: true,
        stem: true,
        options: true,
        correctKeys: true,
        explanation: true,
        docUrls: true,
        domain: { select: { code: true, nameEn: true, namePt: true } },
      },
    }),
    db.answer.findMany({
      where: { attemptId: a.id },
      select: { questionId: true, selectedKeys: true, isCorrect: true },
    }),
  ]);
  const porId = new Map(questoes.map((q) => [q.id, q]));
  const respostaDe = new Map(respostas.map((r) => [r.questionId, r]));
  const encerrado = a.status !== "IN_PROGRESS";
  return {
    id: a.id,
    mode: a.mode,
    status: a.status,
    examCode: a.examVersion.code,
    deadlineAt: a.deadlineAt?.toISOString() ?? null,
    serverNow: agora.toISOString(),
    questoes: a.questionIds.flatMap((id) => {
      const q = porId.get(id);
      if (!q) return [];
      const r = respostaDe.get(id);
      const revelar = encerrado || (a.mode === "TREINO" && r !== undefined);
      return [
        {
          id: q.id,
          stem: q.stem,
          options: Alternativas.parse(q.options),
          quantasCorretas: q.correctKeys.length,
          dominio: `${q.domain.code}. ${q.domain.namePt ?? q.domain.nameEn}`,
          selecionadas: r?.selectedKeys ?? null,
          feedback: revelar
            ? {
                isCorrect: r?.isCorrect ?? false,
                correctKeys: q.correctKeys,
                explanation: q.explanation,
                docUrls: q.docUrls,
              }
            : null,
        },
      ];
    }),
  };
}

/**
 * Registra uma resposta. Treino: uma vez por questão, com feedback imediato. Prova: pode
 * trocar até o envio, sem feedback; depois do prazo (com folga) é recusada e a prova encerra.
 */
export async function responder(
  userId: string,
  attemptId: string,
  questionId: string,
  marcadas: string[],
): Promise<Feedback | null> {
  const agora = new Date();
  if (await expirarSeVenceu(userId, attemptId, agora))
    throw new AppError("O tempo da prova acabou. Suas respostas foram enviadas.", "prazo");
  return db.$transaction(async (tx) => {
    await travar(tx, attemptId);
    const a = await simuladoDoUsuario(tx, userId, attemptId);
    if (a.status === "EXPIRED") throw new AppError("O tempo da prova acabou.", "prazo");
    if (a.status !== "IN_PROGRESS") throw new AppError("Este simulado já foi encerrado.", "encerrado");
    if (!dentroDoPrazo(a.deadlineAt, agora)) throw new AppError("O tempo da prova acabou.", "prazo");
    if (!a.questionIds.includes(questionId)) throw new AppError("Questão não encontrada.", "nao_encontrado");
    const q = await tx.question.findUniqueOrThrow({
      where: { id: questionId },
      select: { options: true, correctKeys: true, explanation: true, docUrls: true, domainId: true, topicId: true },
    });
    const chaves = Alternativas.parse(q.options).map((o) => o.key);
    if (!selecaoValida(chaves, q.correctKeys.length, marcadas))
      throw new AppError(
        q.correctKeys.length === 1 ? "Escolha uma alternativa." : `Escolha ${q.correctKeys.length} alternativas.`,
        "validacao",
      );
    const isCorrect = corrigir(q.correctKeys, marcadas);
    const existente = await tx.answer.findUnique({
      where: { attemptId_questionId: { attemptId, questionId } },
      select: { id: true },
    });
    if (existente) {
      if (a.mode === "TREINO") throw new AppError("Questão já respondida.", "repetida");
      await tx.answer.update({ where: { id: existente.id }, data: { selectedKeys: marcadas, isCorrect } });
      return null;
    }
    const ultima = await tx.answer.findFirst({
      where: { attemptId },
      orderBy: { answeredAt: "desc" },
      select: { answeredAt: true },
    });
    await tx.answer.create({
      data: {
        attemptId,
        userId,
        questionId,
        domainId: q.domainId,
        topicId: q.topicId,
        selectedKeys: marcadas,
        isCorrect,
        timeMs: tempoDeResposta(ultima?.answeredAt ?? a.startedAt, agora),
        answeredAt: agora,
      },
    });
    return a.mode === "TREINO"
      ? { isCorrect, correctKeys: q.correctKeys, explanation: q.explanation, docUrls: q.docUrls }
      : null;
  });
}

/** Envia o simulado (ou encerra o treino) e grava o relatório. */
export async function enviarSimulado(userId: string, attemptId: string) {
  const agora = new Date();
  if (await expirarSeVenceu(userId, attemptId, agora)) return;
  await simuladoDoUsuario(db, userId, attemptId);
  await db.$transaction((tx) => finalizarTx(tx, attemptId, "SUBMITTED", agora));
}

export type LinhaRelatorioDTO = {
  domainId: string;
  codigo: string;
  nome: string;
  total: number;
  corretas: number;
  pct: number;
};

/** Simulados do usuário, do mais recente ao mais antigo. */
export async function historicoSimulados(userId: string, take = 20) {
  const linhas = await db.mockAttempt.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take,
    select: {
      id: true,
      mode: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      correctCount: true,
      questionIds: true,
      examVersion: { select: { code: true } },
    },
  });
  return linhas.map((l) => ({
    id: l.id,
    mode: l.mode,
    status: l.status,
    startedAt: l.startedAt,
    submittedAt: l.submittedAt,
    examCode: l.examVersion.code,
    total: l.questionIds.length,
    corretas: l.correctCount,
  }));
}

/** Relatório de um simulado encerrado do próprio usuário. */
export async function relatorioSimulado(userId: string, attemptId: string) {
  await expirarSeVenceu(userId, attemptId, new Date());
  const a = await db.mockAttempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      mode: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      correctCount: true,
      questionIds: true,
      domainReport: true,
      examVersionId: true,
      examVersion: { select: { code: true } },
    },
  });
  if (!a) throw new AppError("Simulado não encontrado.", "nao_encontrado");
  if (a.status === "IN_PROGRESS") return null;
  const total = a.questionIds.length;
  return {
    id: a.id,
    mode: a.mode,
    status: a.status,
    examVersionId: a.examVersionId,
    examCode: a.examVersion.code,
    startedAt: a.startedAt,
    submittedAt: a.submittedAt,
    total,
    corretas: a.correctCount ?? 0,
    pct: total === 0 ? 0 : Math.round(((a.correctCount ?? 0) / total) * 100),
    dominios: (a.domainReport ?? []) as LinhaRelatorioDTO[],
  };
}

/** Simulado em andamento do usuário, se houver (para retomar). */
export async function simuladoEmAndamento(userId: string) {
  const a = await db.mockAttempt.findFirst({
    where: { userId, status: "IN_PROGRESS" },
    select: { id: true, mode: true, deadlineAt: true, examVersion: { select: { code: true } } },
  });
  if (!a) return null;
  if (!dentroDoPrazo(a.deadlineAt, new Date())) {
    await expirarSeVenceu(userId, a.id, new Date());
    return null;
  }
  return { id: a.id, mode: a.mode, examCode: a.examVersion.code };
}
