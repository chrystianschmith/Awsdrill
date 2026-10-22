import "server-only";
import { db } from "@/lib/db";
import { FORMATO_EXPORTACAO, SELECT_EXPORTACAO } from "./lgpd";
import { hashSenha } from "./senha";
import {
  avaliarToken,
  expiraEm,
  formatoTokenValido,
  gerarToken,
  hashToken,
  TTL_CONFIRMACAO_MS,
  TTL_RESET_MS,
  type EstadoToken,
} from "./tokens";

/**
 * Operações de banco da autenticação, sem dependência de cookies/headers,
 * para poderem ser testadas com o banco (tests/integration/auth.test.ts).
 * As Server Actions em ./actions.ts cuidam de sessão, rate limit e e-mails.
 */

export { VERSAO_TERMOS } from "./lgpd";

// ─── Confirmação de e-mail ─────────────────────────────────────────

/** Emite um token de confirmação (24h) e descarta os não usados anteriores. */
export async function emitirTokenConfirmacao(userId: string, agora = new Date()): Promise<string> {
  const token = gerarToken();
  await db.$transaction([
    db.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } }),
    db.emailVerificationToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: expiraEm(TTL_CONFIRMACAO_MS, agora) },
    }),
  ]);
  return token;
}

export type ResultadoConfirmacao = { estado: "ok"; userId: string } | { estado: Exclude<EstadoToken, "valido"> };

/** Confirma o e-mail com um token de uso único. */
export async function confirmarEmailComToken(token: string, agora = new Date()): Promise<ResultadoConfirmacao> {
  if (!formatoTokenValido(token)) return { estado: "inexistente" };
  const registro = await db.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  const estado = avaliarToken(registro, agora);
  if (estado !== "valido" || !registro) return { estado: estado === "valido" ? "inexistente" : estado };

  return db.$transaction(async (tx) => {
    // Marca como usado só se ainda não foi (corrida entre dois cliques).
    const { count } = await tx.emailVerificationToken.updateMany({
      where: { id: registro.id, usedAt: null },
      data: { usedAt: agora },
    });
    if (count !== 1) return { estado: "usado" as const };
    await tx.user.updateMany({
      where: { id: registro.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: agora },
    });
    return { estado: "ok" as const, userId: registro.userId };
  });
}

// ─── Redefinição de senha ──────────────────────────────────────────

/** Emite um token de reset (30 min) e invalida os anteriores ainda não usados. */
export async function emitirTokenReset(userId: string, agora = new Date()): Promise<string> {
  const token = gerarToken();
  await db.$transaction([
    db.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: agora } }),
    db.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: expiraEm(TTL_RESET_MS, agora) },
    }),
  ]);
  return token;
}

/** Estado do token de reset, sem consumi-lo (para a página validar antes do formulário). */
export async function estadoTokenReset(token: string, agora = new Date()): Promise<EstadoToken> {
  if (!formatoTokenValido(token)) return "inexistente";
  const registro = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, usedAt: true, user: { select: { deletedAt: true } } },
  });
  if (registro?.user.deletedAt) return "inexistente";
  return avaliarToken(registro, agora);
}

export type ResultadoRedefinicao =
  { estado: "ok"; userId: string; email: string; nome: string } | { estado: Exclude<EstadoToken, "valido"> };

/**
 * Redefine a senha: marca o token como usado, troca o hash e revoga todas as
 * sessões do usuário, numa transação.
 */
export async function redefinirSenhaComToken(
  token: string,
  novaSenha: string,
  agora = new Date(),
): Promise<ResultadoRedefinicao> {
  if (!formatoTokenValido(token)) return { estado: "inexistente" };
  const registro = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  const estado = avaliarToken(registro, agora);
  if (estado !== "valido" || !registro) return { estado: estado === "valido" ? "inexistente" : estado };

  const passwordHash = await hashSenha(novaSenha);
  return db.$transaction(async (tx) => {
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: registro.id, usedAt: null },
      data: { usedAt: agora },
    });
    if (count !== 1) return { estado: "usado" as const };
    const user = await tx.user.update({
      where: { id: registro.userId },
      data: { passwordHash },
      select: { id: true, email: true, name: true },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    // Qualquer outro link pendente deixa de valer.
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: agora } });
    return { estado: "ok" as const, userId: user.id, email: user.email, nome: user.name };
  });
}

// ─── LGPD: exportar e excluir ──────────────────────────────────────

/** Todos os dados do usuário em JSON (sem hashes de senha/token). Cobertura em ./lgpd.ts. */
export async function exportarDadosDoUsuario(userId: string) {
  const usuario = await db.user.findUniqueOrThrow({ where: { id: userId }, select: SELECT_EXPORTACAO });
  return { exportadoEm: new Date().toISOString(), formato: FORMATO_EXPORTACAO, usuario };
}

/**
 * Exclui a conta. As relações em cascata apagam sessões, tokens, aceites e
 * preferências; os logs de auditoria ficam sem userId e sem IP.
 */
export async function excluirDadosDoUsuario(userId: string): Promise<void> {
  await db.$transaction([
    db.auditLog.updateMany({ where: { userId }, data: { ip: null } }),
    db.user.delete({ where: { id: userId } }),
  ]);
}
