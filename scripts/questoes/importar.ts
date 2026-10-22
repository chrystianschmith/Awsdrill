/**
 * Banco de questões: importação e moderação (até a tela de admin da etapa 8).
 *
 *   npx tsx scripts/questoes/importar.ts <arquivo.json>              valida e importa como pendentes
 *   npx tsx scripts/questoes/importar.ts --pendentes <EXAME>          lista as pendentes do exame
 *   npx tsx scripts/questoes/importar.ts --aprovar <id> [<id>...]     publica
 *   npx tsx scripts/questoes/importar.ts --rejeitar <id> --nota "…"   rejeita com motivo
 *
 * O arquivo segue ArquivoQuestoes (src/lib/simulados/schemas.ts). Nunca importe questão real de prova.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { createAdapter } from "../../src/lib/db-adapter";
import { importarQuestoes, moderarQuestoes } from "../../src/lib/simulados/importacao";
import { ArquivoQuestoes } from "../../src/lib/simulados/schemas";

function valoresDe(nome: string): string[] {
  const i = process.argv.indexOf(nome);
  if (i === -1) return [];
  const valores: string[] = [];
  for (const v of process.argv.slice(i + 1)) {
    if (v.startsWith("--")) break;
    valores.push(v);
  }
  if (valores.length === 0) throw new Error(`${nome} precisa de um valor.`);
  return valores;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida.");
  const db = new PrismaClient({ adapter: createAdapter(url) });
  try {
    const pendentes = valoresDe("--pendentes");
    const aprovar = valoresDe("--aprovar");
    const rejeitar = valoresDe("--rejeitar");

    if (pendentes.length > 0) {
      const qs = await db.question.findMany({
        where: { examVersion: { code: pendentes[0] }, publishState: "PENDING_REVIEW" },
        orderBy: { importedAt: "asc" },
        select: { id: true, stem: true, domain: { select: { code: true } }, topic: { select: { code: true } } },
      });
      for (const q of qs) console.info(`${q.id}  [${q.topic?.code ?? q.domain.code}]  ${q.stem.slice(0, 100)}`);
      console.info(`${qs.length} pendente(s).`);
      return;
    }
    if (aprovar.length > 0) {
      console.info(`${await moderarQuestoes(db, aprovar, { aprovar: true })} questão(ões) publicada(s).`);
      return;
    }
    if (rejeitar.length > 0) {
      const [nota] = valoresDe("--nota");
      console.info(
        `${await moderarQuestoes(db, rejeitar, { aprovar: false, nota: nota! })} questão(ões) rejeitada(s).`,
      );
      return;
    }

    const caminho = process.argv[2];
    if (!caminho || caminho.startsWith("--")) throw new Error("Informe o arquivo JSON.");
    const lido = ArquivoQuestoes.safeParse(JSON.parse(readFileSync(caminho, "utf8")));
    if (!lido.success) {
      for (const i of lido.error.issues) console.error(`${i.path.join(".")}: ${i.message}`);
      process.exitCode = 1;
      return;
    }
    const r = await importarQuestoes(db, lido.data);
    for (const e of r.erros) console.error(`questão ${e.indice}: ${e.motivo}`);
    console.info(
      `${r.criadas} importada(s) para moderação, ${r.duplicadas} já existia(m), ${r.erros.length} com erro.`,
    );
    if (r.erros.length > 0) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
