/**
 * Valida lotes de questões sem banco: ArquivoQuestoes, códigos do exam guide e duplicatas entre arquivos.
 *   npx tsx scripts/questoes/validar.ts tarefas            -> JSON com exames e tarefas do catálogo
 *   npx tsx scripts/questoes/validar.ts <a.json> [...]     -> relatório JSON por arquivo
 * Também aceita "-" para ler um ArquivoQuestoes do stdin (uso pelo gerador).
 */
import { readFileSync } from "node:fs";
import { ArquivoQuestoes } from "../../src/lib/simulados/schemas";
import { hashQuestao } from "../../src/lib/simulados/regras";
import { EXAMES_INICIAIS } from "../../prisma/catalogo/exames";

const codigos = new Map<string, Set<string>>();
for (const e of EXAMES_INICIAIS) {
  const s = new Set<string>();
  for (const d of e.dominios) {
    s.add(d.codigo);
    for (const t of d.tarefas) s.add(t.codigo);
  }
  codigos.set(e.codigo, s);
}

const args = process.argv.slice(2);
if (args[0] === "tarefas") {
  console.log(
    JSON.stringify(
      EXAMES_INICIAIS.map((e) => ({
        exame: e.codigo,
        nome: e.certificacao.nome,
        dominios: e.dominios.map((d) => ({
          codigo: d.codigo,
          nomeEn: d.nomeEn,
          peso: d.peso,
          tarefas: d.tarefas.map((t) => ({ codigo: t.codigo, nomeEn: t.nomeEn })),
        })),
      })),
    ),
  );
  process.exit(0);
}

/** Questão como veio no arquivo, antes do schema. */
type Bruta = { dominio?: unknown; tipo?: unknown; enunciado?: unknown; alternativas?: unknown } | null;

const vistos = new Map<string, string>(); // hash -> "arquivo#indice"
const relatorio = args.map((arq) => {
  const bruto = JSON.parse(arq === "-" ? readFileSync(0, "utf8") : readFileSync(arq, "utf8"));
  const r = ArquivoQuestoes.safeParse(bruto);
  const erros = r.success ? [] : r.error.issues.map((i) => ({ caminho: i.path.join("."), mensagem: i.message }));
  const extras: { indice: number; problema: string }[] = [];
  const porDominio: Record<string, number> = {};
  const porTipo: Record<string, number> = {};
  const duplicatas: string[] = [];
  const questoes: Bruta[] = Array.isArray(bruto?.questoes) ? bruto.questoes : [];
  const validos = codigos.get(bruto?.exame) ?? new Set<string>();
  if (!codigos.has(bruto?.exame)) extras.push({ indice: -1, problema: `exame ${bruto?.exame} fora do catálogo` });
  questoes.forEach((q: Bruta, i: number) => {
    const dominio = String(q?.dominio);
    const tipo = String(q?.tipo);
    porDominio[dominio] = (porDominio[dominio] ?? 0) + 1;
    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
    if (!validos.has(dominio)) extras.push({ indice: i, problema: `código ${q?.dominio} não existe no exam guide` });
    if (typeof q?.enunciado === "string" && Array.isArray(q?.alternativas)) {
      const h = hashQuestao(q.enunciado, q.alternativas as { text: string }[]);
      const onde = `${arq}#${i}`;
      if (vistos.has(h)) duplicatas.push(`${onde} = ${vistos.get(h)}`);
      else vistos.set(h, onde);
    }
  });
  return {
    arquivo: arq,
    exame: bruto?.exame,
    valido: r.success && extras.length === 0,
    total: questoes.length,
    erros,
    extras,
    porDominio,
    porTipo,
    duplicatas,
  };
});
console.log(JSON.stringify(relatorio, null, 1));
process.exit(relatorio.every((r) => r.valido) ? 0 : 1);
