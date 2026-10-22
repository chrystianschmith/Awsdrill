import { mkdir, rm } from "node:fs/promises";
import { PASTA_EMAILS } from "./apoio/constantes";
import { banco, fecharBanco } from "./apoio/db";

/** Banco exclusivo dos testes: apaga contas e limites de execuções anteriores. */
export default async function globalSetup() {
  await rm(PASTA_EMAILS, { recursive: true, force: true });
  await mkdir(PASTA_EMAILS, { recursive: true });
  const db = banco();
  await db.query(`DELETE FROM "User" WHERE email LIKE '%@e2e.test'`);
  await db.query(`DELETE FROM "RateLimit"`);
  await fecharBanco();
}
