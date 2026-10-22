export const MINIMO_POR_DOMINIO_MIN = 30;

export type DominioCiclo = {
  domainId: string;
  /** Peso do domínio no blueprint (ver pesosEfetivos). */
  peso: number;
  /** Taxa de acerto de 0 a 1; null = sem questões registradas. */
  taxaAcerto: number | null;
};

/** fator_desempenho = 1 + (1 − taxa de acerto); sem questões → 1. */
export function fatorDesempenho(taxaAcerto: number | null): number {
  if (taxaAcerto === null || Number.isNaN(taxaAcerto)) return 1;
  const t = Math.min(1, Math.max(0, taxaAcerto));
  return 1 + (1 - t);
}

export class CicloInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CicloInvalidoError";
  }
}

/**
 * Distribuição sugerida do ciclo: peso × fator de desempenho, normalizada para
 * somar exatamente `totalMin`, com no mínimo 30 min por domínio.
 */
export function distribuirCiclo(
  dominios: DominioCiclo[],
  totalMin: number,
  minimoMin = MINIMO_POR_DOMINIO_MIN,
): Map<string, number> {
  if (dominios.length === 0) throw new CicloInvalidoError("Escolha pelo menos um domínio para o ciclo.");
  const total = Math.floor(totalMin);
  if (total < dominios.length * minimoMin) {
    throw new CicloInvalidoError(
      `Com ${dominios.length} domínios, o ciclo precisa de pelo menos ${dominios.length * minimoMin} minutos.`,
    );
  }

  const bruto = new Map(dominios.map((m) => [m.domainId, Math.max(0.0001, m.peso) * fatorDesempenho(m.taxaAcerto)]));
  const fixos = new Set<string>();
  let valores = new Map<string, number>();

  // Fixa no mínimo quem ficaria abaixo dele e redistribui o restante entre os demais.
  for (;;) {
    const livres = dominios.filter((m) => !fixos.has(m.domainId));
    const restante = total - fixos.size * minimoMin;
    const somaLivres = livres.reduce((s, m) => s + (bruto.get(m.domainId) ?? 0), 0);
    valores = new Map();
    for (const id of fixos) valores.set(id, minimoMin);
    let novos = 0;
    for (const m of livres) {
      const v = (restante * (bruto.get(m.domainId) ?? 0)) / somaLivres;
      if (v < minimoMin) {
        fixos.add(m.domainId);
        novos += 1;
      }
      valores.set(m.domainId, v);
    }
    if (novos === 0) break;
  }

  // Arredonda para minutos inteiros mantendo a soma (maiores restos).
  const inteiros = new Map<string, number>();
  let soma = 0;
  for (const [id, v] of valores) {
    const f = Math.floor(v);
    inteiros.set(id, f);
    soma += f;
  }
  const porResto = [...valores.entries()].sort((a, b) => (b[1] % 1) - (a[1] % 1));
  for (let i = 0; soma < total; i = (i + 1) % porResto.length) {
    const id = porResto[i]![0];
    inteiros.set(id, (inteiros.get(id) ?? 0) + 1);
    soma += 1;
  }
  return inteiros;
}

export type ItemCiclo = { domainId: string; targetMin: number; doneMin: number };

export function saldoPendente(item: ItemCiclo): number {
  return Math.max(0, item.targetMin - item.doneMin);
}

/** Próximo domínio do ciclo: a de maior saldo pendente (empate: ordem da lista). */
export function proximoDominio(itens: ItemCiclo[]): ItemCiclo | null {
  let melhor: ItemCiclo | null = null;
  for (const i of itens) {
    if (saldoPendente(i) > 0 && (!melhor || saldoPendente(i) > saldoPendente(melhor))) melhor = i;
  }
  return melhor;
}

export function cicloCumprido(itens: ItemCiclo[]): boolean {
  return itens.length > 0 && itens.every((i) => i.doneMin >= i.targetMin);
}

export function progressoCiclo(itens: ItemCiclo[]): number {
  const alvo = itens.reduce((s, i) => s + i.targetMin, 0);
  const feito = itens.reduce((s, i) => s + Math.min(i.doneMin, i.targetMin), 0);
  return alvo === 0 ? 0 : Math.round((feito / alvo) * 100);
}
