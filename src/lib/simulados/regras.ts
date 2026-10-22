import { createHash } from "node:crypto";
import type { Alternativa } from "./schemas";

/** Folga para a latência da rede: resposta até 5 s depois do prazo ainda conta. */
export const FOLGA_PRAZO_MS = 5_000;
/** Teto do tempo de uma resposta (aba esquecida aberta não distorce a média). */
export const TETO_TEMPO_RESPOSTA_MS = 15 * 60_000;
export const TAMANHOS_TREINO = [10, 20, 30] as const;

const normalizar = (t: string) => t.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** Hash para deduplicar: mesmo enunciado e mesmas alternativas (em qualquer ordem) = mesma questão. */
export function hashQuestao(enunciado: string, alternativas: Pick<Alternativa, "text">[]): string {
  const textos = alternativas.map((a) => normalizar(a.text)).sort();
  return createHash("sha256")
    .update(JSON.stringify([normalizar(enunciado), textos]))
    .digest("hex");
}

/** Corrige no servidor: certo só se marcou exatamente as corretas (como na prova). */
export function corrigir(corretas: string[], marcadas: string[]): boolean {
  const c = new Set(corretas);
  const m = new Set(marcadas);
  return c.size === m.size && [...c].every((k) => m.has(k));
}

/** Seleção válida: chaves existentes, sem repetir, na quantidade que o enunciado pede. */
export function selecaoValida(chavesDaQuestao: string[], quantasCorretas: number, marcadas: string[]): boolean {
  return (
    marcadas.length === quantasCorretas &&
    new Set(marcadas).size === marcadas.length &&
    marcadas.every((k) => chavesDaQuestao.includes(k))
  );
}

export function prazoDaProva(inicio: Date, duracaoMin: number): Date {
  return new Date(inicio.getTime() + duracaoMin * 60_000);
}

/** Ainda dá para responder? Sem prazo (treino), sempre. */
export function dentroDoPrazo(prazo: Date | null, agora: Date): boolean {
  return prazo === null || agora.getTime() <= prazo.getTime() + FOLGA_PRAZO_MS;
}

/** Tempo da resposta medido no servidor desde a última ação no simulado, com teto. */
export function tempoDeResposta(ultimaAcao: Date, agora: Date): number {
  return Math.min(TETO_TEMPO_RESPOSTA_MS, Math.max(0, agora.getTime() - ultimaAcao.getTime()));
}

/**
 * Quantas questões de cada domínio, proporcional ao peso e limitado ao que existe no banco.
 * O que um domínio não consegue preencher é redistribuído entre os outros pelo mesmo peso;
 * arredondamento pelos maiores restos, para somar exatamente min(n, disponível).
 */
export function cotasPorDominio(
  dominios: { domainId: string; peso: number; disponiveis: number }[],
  n: number,
): Map<string, number> {
  const total = Math.min(
    Math.max(0, Math.floor(n)),
    dominios.reduce((s, d) => s + d.disponiveis, 0),
  );
  const peso = (d: { peso: number }) => Math.max(d.peso, 0.0001);
  const cheios = new Map<string, number>();
  let ideal = new Map<string, number>();
  // Quem pediria mais do que tem fica cheio; o resto é redividido entre os demais.
  for (;;) {
    const livres = dominios.filter((d) => !cheios.has(d.domainId) && d.disponiveis > 0);
    const alvo = total - [...cheios.values()].reduce((s, v) => s + v, 0);
    const soma = livres.reduce((s, d) => s + peso(d), 0);
    ideal = new Map(livres.map((d) => [d.domainId, soma === 0 ? 0 : (alvo * peso(d)) / soma]));
    const estouro = livres.filter((d) => (ideal.get(d.domainId) ?? 0) > d.disponiveis);
    if (estouro.length === 0) break;
    for (const d of estouro) cheios.set(d.domainId, d.disponiveis);
  }
  const cotas = new Map(dominios.map((d) => [d.domainId, cheios.get(d.domainId) ?? 0]));
  let soma = [...cotas.values()].reduce((s, v) => s + v, 0);
  for (const [id, v] of ideal) {
    cotas.set(id, Math.floor(v));
    soma += Math.floor(v);
  }
  // Maiores restos; ideal ≤ disponíveis, então arredondar para cima nunca passa do banco.
  const porResto = [...ideal].sort((a, b) => (b[1] % 1) - (a[1] % 1));
  for (let i = 0; soma < total && porResto.length > 0; i = (i + 1) % porResto.length) {
    const id = porResto[i]![0];
    cotas.set(id, (cotas.get(id) ?? 0) + 1);
    soma += 1;
  }
  return cotas;
}

export function embaralhar<T>(itens: T[], aleatorio: () => number = Math.random): T[] {
  const r = [...itens];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
}

/**
 * Sorteio do simulado: cotas por peso do blueprint, questões aleatórias dentro de cada
 * domínio (as ainda não vistas primeiro) e ordem final embaralhada.
 */
export function sortearQuestoes(
  banco: { id: string; domainId: string; vista: boolean }[],
  pesos: Map<string, number>,
  n: number,
  aleatorio: () => number = Math.random,
): string[] {
  const porDominio = new Map<string, { id: string; vista: boolean }[]>();
  for (const q of banco) {
    if (!pesos.has(q.domainId)) continue;
    const lista = porDominio.get(q.domainId) ?? [];
    lista.push(q);
    porDominio.set(q.domainId, lista);
  }
  const cotas = cotasPorDominio(
    [...porDominio].map(([domainId, qs]) => ({ domainId, peso: pesos.get(domainId) ?? 0, disponiveis: qs.length })),
    n,
  );
  const escolhidas: string[] = [];
  for (const [domainId, qs] of porDominio) {
    const novas = embaralhar(
      qs.filter((q) => !q.vista),
      aleatorio,
    );
    const vistas = embaralhar(
      qs.filter((q) => q.vista),
      aleatorio,
    );
    escolhidas.push(...[...novas, ...vistas].slice(0, cotas.get(domainId) ?? 0).map((q) => q.id));
  }
  return embaralhar(escolhidas, aleatorio);
}

export type LinhaRelatorio = { domainId: string; total: number; corretas: number; pct: number };

/** Relatório por domínio: questão sem resposta conta como errada. */
export function relatorioPorDominio(
  questoes: { id: string; domainId: string }[],
  respostas: { questionId: string; isCorrect: boolean }[],
): { corretas: number; total: number; pct: number; dominios: LinhaRelatorio[] } {
  const certas = new Set(respostas.filter((r) => r.isCorrect).map((r) => r.questionId));
  const linhas = new Map<string, LinhaRelatorio>();
  for (const q of questoes) {
    const l = linhas.get(q.domainId) ?? { domainId: q.domainId, total: 0, corretas: 0, pct: 0 };
    l.total += 1;
    if (certas.has(q.id)) l.corretas += 1;
    linhas.set(q.domainId, l);
  }
  const dominios = [...linhas.values()].map((l) => ({ ...l, pct: Math.round((l.corretas / l.total) * 100) }));
  const corretas = dominios.reduce((s, l) => s + l.corretas, 0);
  const total = questoes.length;
  return { corretas, total, pct: total === 0 ? 0 : Math.round((corretas / total) * 100), dominios };
}
