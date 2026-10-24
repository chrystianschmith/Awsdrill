import type { Prisma } from "@/generated/prisma/client";

/**
 * LGPD: o que a exportação leva de cada relação do usuário. Toda relação de
 * `User` no schema precisa estar aqui, exportada ou com o motivo de ficar fora;
 * tests/unit/auth/lgpd.test.ts lê o schema e falha quando um modelo novo com
 * `userId` não for classificado.
 */
export const RELACOES_DO_USUARIO = {
  sessions: "exportado",
  consents: "exportado",
  notificationPreference: "exportado",
  auditLogs: "exportado",
  userExams: "exportado",
  studySessions: "exportado",
  userTopics: "exportado",
  studyCycles: "exportado",
  reviews: "exportado",
  mockAttempts: "exportado",
  readinessScores: "exportado",
  contentReports: "exportado",
  subscription: "exportado",
  certifications: "exportado",
  answers: "fora: exportadas dentro de mockAttempts, junto do simulado de cada uma",
  emailVerificationTokens: "fora: só guarda o hash de um link de uso único, sem valor para o titular",
  passwordResetTokens: "fora: só guarda o hash de um link de uso único, sem valor para o titular",
} as const satisfies Record<string, "exportado" | `fora: ${string}`>;

export type RelacaoDoUsuario = keyof typeof RELACOES_DO_USUARIO;

/** Campos exportados. Nunca inclui hash de senha nem de token. */
export const SELECT_EXPORTACAO = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  dailyGoalMin: true,
  streakMinMin: true,
  pomodoroWorkMin: true,
  pomodoroBreakMin: true,
  pomodoroLongMin: true,
  pomodoroLongEvery: true,
  sessions: { select: { createdAt: true, lastSeenAt: true, expiresAt: true, userAgent: true } },
  consents: { select: { kind: true, version: true, acceptedAt: true, ip: true } },
  notificationPreference: {
    select: { revisoes: true, mudancaExame: true, recertificacao: true, avisosPagamento: true },
  },
  auditLogs: { select: { action: true, ip: true, createdAt: true }, orderBy: { createdAt: "desc" } },
  userExams: { select: { status: true, examDate: true, createdAt: true, examVersion: { select: { code: true } } } },
  studySessions: {
    select: {
      mode: true,
      manual: true,
      startedAt: true,
      endedAt: true,
      durationSec: true,
      examVersion: { select: { code: true } },
      domain: { select: { code: true } },
      topic: { select: { code: true } },
      pauses: { select: { startedAt: true, endedAt: true } },
    },
    orderBy: { startedAt: "asc" },
  },
  userTopics: {
    select: {
      status: true,
      completedAt: true,
      updatedAt: true,
      topic: { select: { code: true, examVersion: { select: { code: true } } } },
    },
  },
  studyCycles: {
    select: {
      number: true,
      totalMin: true,
      startedAt: true,
      closedAt: true,
      examVersion: { select: { code: true } },
      items: { select: { targetMin: true, doneMin: true, domain: { select: { code: true } } } },
    },
    orderBy: { startedAt: "asc" },
  },
  reviews: {
    select: {
      step: true,
      dueAt: true,
      doneAt: true,
      goodResult: true,
      topic: { select: { code: true, examVersion: { select: { code: true } } } },
    },
    orderBy: { dueAt: "asc" },
  },
  mockAttempts: {
    select: {
      mode: true,
      status: true,
      startedAt: true,
      deadlineAt: true,
      submittedAt: true,
      correctCount: true,
      domainReport: true,
      examVersion: { select: { code: true } },
      answers: {
        select: {
          selectedKeys: true,
          isCorrect: true,
          timeMs: true,
          answeredAt: true,
          question: { select: { stem: true } },
        },
        orderBy: { answeredAt: "asc" },
      },
    },
    orderBy: { startedAt: "asc" },
  },
  readinessScores: {
    select: {
      score: true,
      lowerBound: true,
      upperBound: true,
      coverage: true,
      sampleSize: true,
      methodologyVersion: true,
      computedAt: true,
      examVersion: { select: { code: true } },
      domain: { select: { code: true } },
    },
    orderBy: { computedAt: "asc" },
  },
  contentReports: {
    select: { contentType: true, message: true, resolvedAt: true, createdAt: true, topic: { select: { code: true } } },
    orderBy: { createdAt: "asc" },
  },
  certifications: {
    select: {
      examCode: true,
      result: true,
      examDate: true,
      scaledScore: true,
      expiresAt: true,
      badgeUrl: true,
      createdAt: true,
      certification: { select: { name: true } },
    },
    orderBy: { examDate: "asc" },
  },
  // Sem os ids do Stripe: identificam a conta lá, não dizem nada ao titular.
  subscription: {
    select: {
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      graceUntil: true,
      accessUntil: true,
      effectivePlan: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const satisfies Prisma.UserSelect;

export const FORMATO_EXPORTACAO = "trilha-export-v1";

/** Versão dos termos e da política de privacidade aceitos no cadastro. */
export const VERSAO_TERMOS = "2026-10";
