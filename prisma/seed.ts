/**
 * Seed idempotente: catálogo inicial (exames, domínios e pesos com fonte oficial citada).
 * Uso: npm run db:seed. No build da Vercel roda com SEED_ALLOW_PRODUCTION=1 (scripts/vercel-build.sh).
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { aplicarExame } from "../src/lib/catalogo/publicacao";
import { createAdapter } from "../src/lib/db-adapter";
import { EXAMES_INICIAIS } from "./catalogo/exames";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida.");
  if (process.env.NODE_ENV === "production" && !process.env.SEED_ALLOW_PRODUCTION) {
    throw new Error("Seed bloqueado em produção (defina SEED_ALLOW_PRODUCTION=1 para forçar).");
  }
  const db = new PrismaClient({ adapter: createAdapter(url) });
  try {
    for (const exame of EXAMES_INICIAIS) {
      const r = await aplicarExame(db, exame);
      console.info(
        `seed: ${r.codigo} ${r.publishState} ${r.dataStatus} ${r.revisao === null ? "pesos sem mudança" : `revisão ${r.revisao}`}`,
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
