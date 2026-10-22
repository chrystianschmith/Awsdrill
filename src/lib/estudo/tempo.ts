import { TZDate } from "@date-fns/tz";
import { addDays, getISOWeek, getISOWeekYear, startOfDay, startOfISOWeek } from "date-fns";

export const TZ = "America/Sao_Paulo";

/** Data no fuso de São Paulo. */
export function emSaoPaulo(date: Date): TZDate {
  return new TZDate(date.getTime(), TZ);
}

/** Chave do dia em São Paulo: "2026-10-08". */
export function getDayKey(date: Date): string {
  const d = emSaoPaulo(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Chave da semana ISO (segunda a domingo) em São Paulo: "2026-W41". */
export function getWeekKey(date: Date): string {
  const d = emSaoPaulo(date);
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

/** Início (UTC) do dia de São Paulo que contém `date`. */
export function inicioDoDia(date: Date): Date {
  return new Date(startOfDay(emSaoPaulo(date)).getTime());
}

/** Intervalo [início, fim) da semana de São Paulo que contém `date`. */
export function intervaloDaSemana(date: Date): { inicio: Date; fim: Date } {
  const inicio = startOfISOWeek(emSaoPaulo(date));
  return { inicio: new Date(inicio.getTime()), fim: new Date(addDays(inicio, 7).getTime()) };
}

/** Intervalo [início, fim) a partir de uma chave "2026-W41". */
export function intervaloDaChave(weekKey: string): { inicio: Date; fim: Date } {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) throw new Error(`Chave de semana inválida: ${weekKey}`);
  const ano = Number(m[1]);
  const semana = Number(m[2]);
  // 4 de janeiro está sempre na semana ISO 1.
  const ref = new TZDate(ano, 0, 4, 12, 0, 0, TZ);
  const inicio = addDays(startOfISOWeek(ref), (semana - 1) * 7);
  return { inicio: new Date(inicio.getTime()), fim: new Date(addDays(inicio, 7).getTime()) };
}

/**
 * Divide um intervalo entre os dias de São Paulo que ele atravessa.
 * Retorna segundos por chave de dia.
 */
export function dividirPorDia(inicio: Date, fim: Date): Map<string, number> {
  const resultado = new Map<string, number>();
  let cursor = inicio.getTime();
  const final = fim.getTime();
  while (cursor < final) {
    const proximoDia = new Date(addDays(startOfDay(emSaoPaulo(new Date(cursor))), 1).getTime()).getTime();
    const corte = Math.min(proximoDia, final);
    const chave = getDayKey(new Date(cursor));
    resultado.set(chave, (resultado.get(chave) ?? 0) + Math.round((corte - cursor) / 1000));
    cursor = corte;
  }
  return resultado;
}

/** Soma `n` dias a uma chave de dia ("2026-10-08" + 1 → "2026-10-09"). Independe de fuso. */
export function somarDias(dayKey: string, n: number): string {
  const d = new Date(`${dayKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Início (UTC) do dia de São Paulo `n` dias depois do dia que contém `date`. */
export function inicioDoDiaMais(date: Date, n: number): Date {
  return new Date(addDays(startOfDay(emSaoPaulo(date)), n).getTime());
}

/** Dia da semana em São Paulo: 0 = domingo, 1 = segunda... */
export function diaDaSemana(date: Date): number {
  return emSaoPaulo(date).getDay();
}

/** Diferença em dias entre duas chaves de dia (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}
