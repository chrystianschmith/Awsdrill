/**
 * Pipeline mensal do catálogo (GitHub Actions, .github/workflows/pipeline-catalogo.yml).
 *
 *   npx tsx scripts/pipeline/catalogo.ts             lê os exam guides, publica ou manda para a moderação
 *   npx tsx scripts/pipeline/catalogo.ts --dry-run   só lê e compara (sem DATABASE_URL, compara com o seed)
 *   npx tsx scripts/pipeline/catalogo.ts --aprovar <id> | --rejeitar <id>   decide uma revisão da fila
 *
 * Exige PIPELINE_CONTACT_EMAIL (vai no User-Agent). Não usa IA (ADR 0005).
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { aprovarRevisao, rejeitarRevisao } from "../../src/lib/catalogo/moderacao";
import { executarPipeline, verificarExame, type Verificacao } from "../../src/lib/catalogo/pipeline";
import { createAdapter } from "../../src/lib/db-adapter";
import { EXAMES_INICIAIS } from "../../prisma/catalogo/exames";
import { Coletor } from "./coletor";

function argumento(nome: string): string | null {
  const i = process.argv.indexOf(nome);
  if (i === -1) return null;
  const valor = process.argv[i + 1];
  if (!valor || valor.startsWith("--")) throw new Error(`${nome} precisa de um valor.`);
  return valor;
}

function linha(v: Verificacao): string {
  const d = v.diff;
  const mudancas = [
    ...d.fatos.map((f) => `${f.campo}: ${f.de} → ${f.para}`),
    ...d.pesos.map((p) => `peso ${p.codigo}: ${p.de} → ${p.para}`),
    ...d.dominiosIncluidos.map((x) => `+domínio ${x.codigo}`),
    ...d.dominiosRemovidos.map((x) => `-domínio ${x.codigo}`),
    ...d.dominiosRenomeados.map((x) => `~domínio ${x.codigo}`),
    ...d.tarefasIncluidas.map((x) => `+tarefa ${x.codigo}`),
    ...d.tarefasRemovidas.map((x) => `-tarefa ${x.codigo}`),
    ...d.tarefasRenomeadas.map((x) => `~tarefa ${x.codigo}`),
  ];
  return `${v.codigo}: ${v.decisao} (confiança ${v.confianca})${mudancas.length ? ` · ${mudancas.join("; ")}` : ""}${
    v.problemas.length ? `\n  problemas: ${v.problemas.join(" | ")}` : ""
  }`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const aprovar = argumento("--aprovar");
  const rejeitar = argumento("--rejeitar");
  const url = process.env.DATABASE_URL;
  const hoje = new Date().toISOString().slice(0, 10);

  if (!url) {
    if (!dryRun) throw new Error("DATABASE_URL não definida (use --dry-run para só ler e comparar com o seed).");
    const coletor = new Coletor({ contato: process.env.PIPELINE_CONTACT_EMAIL ?? "" });
    const buscar = (u: string) => coletor.obterTexto(u);
    let falhas = 0;
    for (const exame of EXAMES_INICIAIS) {
      try {
        console.info(linha(await verificarExame(exame, buscar, hoje)));
      } catch (err) {
        falhas++;
        console.error(`${exame.codigo}: erro · ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (falhas === EXAMES_INICIAIS.length) process.exit(1);
    return;
  }

  const db = new PrismaClient({ adapter: createAdapter(url) });
  try {
    if (aprovar) {
      const r = await aprovarRevisao(db, aprovar);
      console.info(`aprovada: ${r.codigo} ${r.publishState} ${r.revisao === null ? "pesos sem mudança" : `revisão ${r.revisao}`}`);
      return;
    }
    if (rejeitar) {
      await rejeitarRevisao(db, rejeitar);
      console.info(`rejeitada: ${rejeitar}`);
      return;
    }
    const coletor = new Coletor({ contato: process.env.PIPELINE_CONTACT_EMAIL ?? "" });
    const resumo = await executarPipeline(db, { buscar: (u) => coletor.obterTexto(u), hoje, dryRun });
    for (const v of resumo.verificacoes) console.info(linha(v));
    for (const e of resumo.erros) console.warn(`${e.codigo}: ${e.mensagem}`);
    console.info(
      `execução ${resumo.runId ?? "(dry-run)"}: ${resumo.verificados} verificados, ${resumo.semMudanca} sem mudança, ` +
        `${resumo.publicados} publicados, ${resumo.moderacao} na moderação, ${resumo.erros.length} erros`,
    );
    if (resumo.verificados === 0 && resumo.erros.length > 0) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
