import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Validade do link de confirmação de e-mail. */
export const TTL_CONFIRMACAO_MS = 24 * 60 * 60_000;
/** Validade do link de redefinição de senha. */
export const TTL_RESET_MS = 30 * 60_000;

/** Token aleatório de 32 bytes em base64url. */
export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash SHA-256 em hex; só o hash vai para o banco. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashesIguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Formato de um token emitido por gerarToken (32 bytes = 43 caracteres base64url). */
export function formatoTokenValido(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type EstadoToken = "valido" | "inexistente" | "expirado" | "usado";

/** Regra de validade de um token de uso único. Função pura. */
export function avaliarToken(
  registro: { expiresAt: Date; usedAt: Date | null } | null | undefined,
  agora: Date = new Date(),
): EstadoToken {
  if (!registro) return "inexistente";
  if (registro.usedAt) return "usado";
  if (registro.expiresAt.getTime() <= agora.getTime()) return "expirado";
  return "valido";
}

export function expiraEm(ttlMs: number, agora: Date = new Date()): Date {
  return new Date(agora.getTime() + ttlMs);
}
