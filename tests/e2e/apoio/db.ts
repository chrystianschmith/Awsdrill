import { randomUUID } from "node:crypto";
import { Pool } from "pg";

/**
 * Acesso direto ao Postgres dos testes e2e (SQL simples, sem o cliente do
 * Prisma, que é ESM e não roda no carregador do Playwright).
 */
export function urlBancoE2E(): string {
  const url = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Defina E2E_DATABASE_URL ou DATABASE_URL para os testes e2e.");
  return url;
}

let pool: Pool | undefined;

export function banco(): Pool {
  pool ??= new Pool({ connectionString: urlBancoE2E(), max: 2 });
  return pool;
}

export async function fecharBanco() {
  await pool?.end();
  pool = undefined;
}

export const novoId = () => `e2e${randomUUID().replaceAll("-", "").slice(0, 22)}`;
