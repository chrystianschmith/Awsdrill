/**
 * Seed idempotente: catálogo inicial (exames, domínios e pesos com fonte oficial citada).
 * Só cria exames que ainda não existem: depois disso quem mantém o exame é a pipeline mensal
 * (scripts/pipeline/catalogo.ts), e reaplicar o seed num deploy desfaria uma revisão nova do guia.
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
      if (await db.examVersion.findUnique({ where: { code: exame.codigo }, select: { id: true } })) {
        console.info(`seed: ${exame.codigo} já está no catálogo (mantido pela pipeline)`);
        continue;
      }
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
