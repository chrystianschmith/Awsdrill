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
  sessions: { select: { createdAt: true, lastSeenAt: true, expiresAt: true, userAgent: true } },
  consents: { select: { kind: true, version: true, acceptedAt: true, ip: true } },
  notificationPreference: {
    select: { revisoes: true, mudancaExame: true, recertificacao: true, avisosPagamento: true },
  },
  auditLogs: { select: { action: true, ip: true, createdAt: true }, orderBy: { createdAt: "desc" } },
} as const satisfies Prisma.UserSelect;

export const FORMATO_EXPORTACAO = "trilha-export-v1";

/** Versão dos termos e da política de privacidade aceitos no cadastro. */
export const VERSAO_TERMOS = "2026-10";
