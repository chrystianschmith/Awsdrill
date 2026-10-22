import { getDayKey, somarDias } from "./tempo";

/**
 * Streak: dias consecutivos (em São Paulo) com pelo menos `minimoMin` minutos.
 * Hoje ainda sem o mínimo não quebra a sequência: a contagem começa em ontem.
 */
export function calcularStreak(segPorDia: Map<string, number>, agora: Date, minimoMin: number): number {
  const minimoSeg = Math.max(1, minimoMin) * 60;
  const cumpriu = (dia: string) => (segPorDia.get(dia) ?? 0) >= minimoSeg;
  const hoje = getDayKey(agora);
  let dia = cumpriu(hoje) ? hoje : somarDias(hoje, -1);
  let streak = 0;
  while (cumpriu(dia)) {
    streak += 1;
    dia = somarDias(dia, -1);
  }
  return streak;
}

/** Progresso da meta diária (0 a 100, sem passar de 100). */
export function progressoMeta(segHoje: number, metaMin: number): { minutos: number; pct: number; atingida: boolean } {
  const minutos = Math.floor(segHoje / 60);
  const meta = Math.max(1, metaMin);
  return { minutos, pct: Math.min(100, Math.round((minutos / meta) * 100)), atingida: minutos >= meta };
}
