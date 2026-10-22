import { urlMarkdown } from "@/lib/catalogo/guia";
import type { ExameColetado } from "@/lib/catalogo/schemas";

/**
 * Gera o exam guide em Markdown, no formato da documentação da AWS, a partir de um exame.
 * Devolve o mapa URL → texto que os testes usam no lugar da coleta.
 */
export function guiaEmMarkdown(exame: ExameColetado): Map<string, string> {
  const urlGuia = urlMarkdown(exame.fonteGuia);
  const base = urlGuia.replace(/[^/]+$/, "");
  const paginas = new Map<string, string>();
  const scored = exame.questoesPontuadas ?? 50;
  const unscored = (exame.totalQuestoes ?? 65) - scored;

  const sumario = exame.dominios
    .map((d) => `+ [Content Domain ${d.codigo}: ${d.nomeEn} (${d.peso}% of scored content)](dominio${d.codigo}.md)`)
    .join("\n");
  paginas.set(
    urlGuia,
    `# ${exame.certificacao.nome} (${exame.codigo})\n\n` +
      `Unanswered questions are scored as incorrect. The exam includes ${scored} questions that affect your score.\n\n` +
      `The exam includes ${unscored} unscored questions that do not affect your score.\n\n` +
      `Your results are reported as a scaled score of 100–1,000. The minimum passing score is ${exame.notaCorte}.\n\n` +
      `## Content outline\n\nThe exam has the following content domains and weightings:\n${sumario}\n`,
  );
  for (const d of exame.dominios) {
    const tarefas = d.tarefas.map((t) => `## Task Statement ${t.codigo}: ${t.nomeEn}\n\nKnowledge of:\n+ algo\n`).join("\n");
    paginas.set(`${base}dominio${d.codigo}.md`, `# Content Domain ${d.codigo}: ${d.nomeEn}\n\n${tarefas}`);
  }
  return paginas;
}

export function buscarEm(paginas: Map<string, string>) {
  return async (url: string) => {
    const texto = paginas.get(url);
    if (texto === undefined) throw new Error(`HTTP 404 em ${url}`);
    return texto;
  };
}
