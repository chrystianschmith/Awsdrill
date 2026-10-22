import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { arquivoFicticio } from "../apoio/questoes";
import { PASTA_EMAILS } from "./apoio/constantes";
import { banco, fecharBanco, urlBancoE2E } from "./apoio/db";

/** Banco exclusivo dos testes: apaga contas e limites de execuções anteriores. */
export default async function globalSetup() {
  await rm(PASTA_EMAILS, { recursive: true, force: true });
  await mkdir(PASTA_EMAILS, { recursive: true });
  const db = banco();
  await db.query(`DELETE FROM "User" WHERE email LIKE '%@e2e.test'`);
  await db.query(`DELETE FROM "RateLimit"`);

  // Banco de questões fictícias do CLF-C02 (só no banco do e2e), pelo mesmo script de importação.
  const arquivo = path.join(tmpdir(), "trilha-e2e-questoes.json");
  await writeFile(arquivo, JSON.stringify(arquivoFicticio("CLF-C02", ["1.1", "2.1", "3.1", "4.1"], 12)));
  execFileSync("npx", ["tsx", "scripts/questoes/importar.ts", arquivo], {
    env: { ...process.env, DATABASE_URL: urlBancoE2E() },
    stdio: "ignore",
  });
  await db.query(
    `UPDATE "Question" SET "publishState" = 'PUBLISHED', "reviewedAt" = now()
     WHERE "publishState" = 'PENDING_REVIEW' AND stem LIKE 'Questão fictícia de teste%'`,
  );
  await fecharBanco();
}
