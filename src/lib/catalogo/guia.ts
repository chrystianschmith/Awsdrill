import { urlOficial } from "./fontes";
import type { DominioColetado, ExameColetado } from "./schemas";

/**
 * Leitura determinística dos exam guides oficiais, pela versão Markdown que a documentação da AWS
 * publica ao lado de cada página (`.md` no lugar de `.html`). Sem IA: o formato é estável e o texto
 * é copiado como está (ADR 0005). Funções puras; a coleta fica em scripts/pipeline.
 */

export type DominioDoSumario = { codigo: string; nomeEn: string; peso: number; url: string };

export type GuiaPrincipal = {
  codigo: string | null;
  questoesPontuadas: number | null;
  questoesNaoPontuadas: number | null;
  notaCorte: number | null;
  dominios: DominioDoSumario[];
};

export type PaginaDominio = {
  codigo: string | null;
  nomeEn: string | null;
  /** "represents 34% of the scored content", quando a página repete o peso. */
  peso: number | null;
  tarefas: { codigo: string; nomeEn: string }[];
};

const numero = (texto: string | undefined) => (texto === undefined ? null : Number(texto.replace(/,/g, "")));
const limpar = (texto: string) => texto.replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1").replace(/\s+/g, " ").trim();

/** URL da versão Markdown de uma página do exam guide. */
export function urlMarkdown(urlHtml: string): string {
  const url = new URL(urlHtml);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\.html$/, ".md");
  if (!url.pathname.endsWith(".md")) throw new Error(`URL do exam guide sem página .html: ${urlHtml}`);
  return url.toString();
}

export function lerGuiaPrincipal(md: string, urlDoMd: string): GuiaPrincipal {
  const dominios: DominioDoSumario[] = [];
  const re = /^\s*[+*-]\s*\[(?:Content )?Domain (\d+):\s*(.+?)\s*\((\d+(?:\.\d+)?)% of scored content\)\]\(([^)\s]+)\)/gim;
  for (const m of md.matchAll(re)) {
    const url = new URL(m[4]!, urlDoMd).toString();
    // O link precisa continuar no host oficial: o sumário é dado de fora.
    if (!urlOficial(url)) continue;
    dominios.push({ codigo: m[1]!, nomeEn: limpar(m[2]!), peso: Number(m[3]), url });
  }
  return {
    codigo: /^#\s+.*\(([A-Z]{2,6}-[A-Z0-9]{2,5})\)\s*$/m.exec(md)?.[1] ?? null,
    questoesPontuadas: numero(/The exam includes (\d+) questions that affect your score/i.exec(md)?.[1]),
    questoesNaoPontuadas: numero(/The exam includes (\d+) unscored questions/i.exec(md)?.[1]),
    notaCorte: numero(/minimum passing score is ([\d,]+)/i.exec(md)?.[1]),
    dominios,
  };
}

export function lerPaginaDominio(md: string): PaginaDominio {
  const titulo = /^#\s+(?:Content )?Domain (\d+):\s*(.+?)\s*$/im.exec(md);
  const tarefas = [...md.matchAll(/^##\s+Task(?: Statement)? (\d+\.\d+):\s*(.+?)\s*$/gim)].map((m) => ({
    codigo: m[1]!,
    nomeEn: limpar(m[2]!),
  }));
  return {
    codigo: titulo?.[1] ?? null,
    nomeEn: titulo ? limpar(titulo[2]!) : null,
    peso: numero(/represents (\d+(?:\.\d+)?)% of the scored content/i.exec(md)?.[1]),
    tarefas,
  };
}

/**
 * Junta o que o exam guide diz com o que só a página da certificação informa (duração, preço,
 * status), mantido do registro atual. Tradução nossa (nomePt) só continua onde o nome oficial
 * não mudou. Devolve também os problemas de leitura, que derrubam a confiança.
 */
export function montarColetado(
  atual: ExameColetado,
  guia: GuiaPrincipal,
  paginas: Map<string, PaginaDominio>,
  lidoEm: string,
): { exame: ExameColetado; problemas: string[] } {
  const problemas: string[] = [];
  if (guia.codigo !== atual.codigo) problemas.push(`O guia diz ${guia.codigo ?? "nenhum código"}, esperado ${atual.codigo}.`);
  if (guia.questoesPontuadas === null) problemas.push("Questões pontuadas não encontradas no guia.");
  if (guia.questoesNaoPontuadas === null) problemas.push("Questões não pontuadas não encontradas no guia.");
  if (guia.notaCorte === null) problemas.push("Nota de corte não encontrada no guia.");
  if (guia.dominios.length === 0) problemas.push("Sumário de domínios não encontrado no guia.");

  const dominiosAtuais = new Map(atual.dominios.map((d) => [d.codigo, d]));
  const dominios: DominioColetado[] = guia.dominios.map((d) => {
    const pagina = paginas.get(d.codigo);
    if (!pagina) problemas.push(`Página do domínio ${d.codigo} não lida.`);
    else {
      if (pagina.codigo !== d.codigo) problemas.push(`A página do domínio ${d.codigo} se diz domínio ${pagina.codigo ?? "?"}.`);
      if (pagina.nomeEn !== null && pagina.nomeEn !== d.nomeEn) problemas.push(`Nome do domínio ${d.codigo} difere entre sumário e página.`);
      if (pagina.peso !== null && pagina.peso !== d.peso) problemas.push(`Peso do domínio ${d.codigo} difere entre sumário (${d.peso}%) e página (${pagina.peso}%).`);
      if (pagina.tarefas.length === 0) problemas.push(`Nenhuma task statement na página do domínio ${d.codigo}.`);
    }
    const anterior = dominiosAtuais.get(d.codigo);
    const tarefasAnteriores = new Map(anterior?.tarefas.map((t) => [t.codigo, t]));
    return {
      codigo: d.codigo,
      nomeEn: d.nomeEn,
      nomePt: anterior?.nomeEn === d.nomeEn ? anterior.nomePt : null,
      peso: d.peso,
      tarefas: (pagina?.tarefas ?? []).map((t) => {
        const ta = tarefasAnteriores.get(t.codigo);
        return { codigo: t.codigo, nomeEn: t.nomeEn, nomePt: ta?.nomeEn === t.nomeEn ? ta.nomePt : null };
      }),
    };
  });

  const total =
    guia.questoesPontuadas !== null && guia.questoesNaoPontuadas !== null
      ? guia.questoesPontuadas + guia.questoesNaoPontuadas
      : null;
  return {
    exame: {
      ...atual,
      totalQuestoes: total ?? atual.totalQuestoes,
      questoesPontuadas: guia.questoesPontuadas ?? atual.questoesPontuadas,
      notaCorte: guia.notaCorte ?? atual.notaCorte,
      lidoEm,
      dominios: dominios.length > 0 ? dominios : atual.dominios,
    },
    problemas,
  };
}
