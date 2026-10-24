/*
 * Markdown restrito do conteúdo gerado por IA: parágrafos, subtítulos "### ", listas "- " e "1. ",
 * **negrito** e `código`. Não há HTML, links nem imagens: o resultado é só texto em blocos, que o
 * React escapa ao renderizar (docs/adr/0006-markdown-restrito.md). Função pura.
 */

export type Trecho = { tipo: "texto" | "negrito" | "codigo"; texto: string };

export type Bloco =
  | { tipo: "paragrafo"; trechos: Trecho[] }
  | { tipo: "titulo"; trechos: Trecho[] }
  | { tipo: "lista"; ordenada: boolean; itens: Trecho[][] };

const INLINE = /`([^`\n]+)`|\*\*([^*\n]+)\*\*/g;

export function trechos(linha: string): Trecho[] {
  const saida: Trecho[] = [];
  let ultimo = 0;
  for (const m of linha.matchAll(INLINE)) {
    if (m.index > ultimo) saida.push({ tipo: "texto", texto: linha.slice(ultimo, m.index) });
    saida.push(m[1] !== undefined ? { tipo: "codigo", texto: m[1] } : { tipo: "negrito", texto: m[2]! });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linha.length) saida.push({ tipo: "texto", texto: linha.slice(ultimo) });
  return saida;
}

const ITEM = /^\s*(?:([-*])|(\d{1,2})[.)])\s+(.*)$/;
const TITULO = /^#{1,4}\s+(.*)$/;

export function analisarMarkdown(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;

  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push({ tipo: "paragrafo", trechos: trechos(paragrafo.join(" ")) });
    paragrafo = [];
  };
  const fecharLista = () => {
    if (lista) blocos.push({ tipo: "lista", ordenada: lista.ordenada, itens: lista.itens.map(trechos) });
    lista = null;
  };

  for (const bruta of texto.replace(/\r\n?/g, "\n").split("\n")) {
    const linha = bruta.trim();
    if (!linha) {
      fecharParagrafo();
      fecharLista();
      continue;
    }
    const titulo = TITULO.exec(linha);
    if (titulo) {
      fecharParagrafo();
      fecharLista();
      blocos.push({ tipo: "titulo", trechos: trechos(titulo[1]!.trim()) });
      continue;
    }
    const item = ITEM.exec(linha);
    if (item) {
      fecharParagrafo();
      const ordenada = item[2] !== undefined;
      if (lista && lista.ordenada !== ordenada) fecharLista();
      lista ??= { ordenada, itens: [] };
      lista.itens.push(item[3]!.trim());
      continue;
    }
    // Linha solta logo depois de um item continua o item.
    if (lista) {
      lista.itens[lista.itens.length - 1] += ` ${linha}`;
      continue;
    }
    paragrafo.push(linha);
  }
  fecharParagrafo();
  fecharLista();
  return blocos;
}
