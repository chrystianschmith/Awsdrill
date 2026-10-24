import "server-only";
import { db } from "@/lib/db";

export type Limite = { max: number; janelaMs: number };

export const LIMITES = {
  loginEmail: { max: 5, janelaMs: 15 * 60_000 },
  loginIp: { max: 20, janelaMs: 15 * 60_000 },
  cadastroIp: { max: 5, janelaMs: 60 * 60_000 },
  resetEmail: { max: 3, janelaMs: 60 * 60_000 },
  confirmacaoUsuario: { max: 3, janelaMs: 60 * 60_000 },
  senhaUsuario: { max: 5, janelaMs: 15 * 60_000 },
  exportarUsuario: { max: 5, janelaMs: 60 * 60_000 },
  iaUsuario: { max: 10, janelaMs: 60 * 60_000 },
  reportUsuario: { max: 20, janelaMs: 60 * 60_000 },
} satisfies Record<string, Limite>;

export class RateLimitError extends Error {
  constructor() {
    super("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
    this.name = "RateLimitError";
  }
}

/** Início da janela fixa que contém `agora`. Função pura. */
export function inicioJanela(agora: number, janelaMs: number): Date {
  return new Date(Math.floor(agora / janelaMs) * janelaMs);
}

/** A tentativa número `contagem` (já incluída) está dentro do limite? Função pura. */
export function dentroDoLimite(contagem: number, limite: Limite): boolean {
  return contagem <= limite.max;
}

/** Chave de rate limit: escopo + identificador (e-mail normalizado, IP ou id). */
export function chaveLimite(escopo: string, identificador: string): string {
  return `${escopo}:${identificador}`;
}

/** Janela fixa no Postgres. Retorna true se ainda está dentro do limite. */
export async function consumir(chave: string, limite: Limite, agora = Date.now()): Promise<boolean> {
  const windowStart = inicioJanela(agora, limite.janelaMs);
  const row = await db.rateLimit.upsert({
    where: { key_windowStart: { key: chave, windowStart } },
    create: { key: chave, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return dentroDoLimite(row.count, limite);
}

/** Lança RateLimitError quando estoura. */
export async function exigirLimite(chave: string, limite: Limite): Promise<void> {
  if (!(await consumir(chave, limite))) throw new RateLimitError();
}

/** Zera o contador de uma chave (ex.: tentativas de login por e-mail após sucesso). */
export async function limparLimite(chave: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key: chave } });
}

/** Remove janelas antigas (cron diário). */
export async function limparRateLimit(antesDe = new Date(Date.now() - 24 * 60 * 60_000)): Promise<number> {
  const { count } = await db.rateLimit.deleteMany({ where: { windowStart: { lt: antesDe } } });
  return count;
}
