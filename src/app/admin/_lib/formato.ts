const dataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});
const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" });
const usd = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export function fmtDataHora(d: Date | null | undefined): string {
  return d ? dataHora.format(d) : "—";
}

export function fmtData(d: Date | null | undefined): string {
  return d ? data.format(d) : "—";
}

export function fmtUsd(valor: number | string | { toString(): string }): string {
  return usd.format(Number(valor.toString()));
}

export function fmtPct(v: number): string {
  return pct.format(v);
}

export function fmtDuracao(inicio: Date, fim: Date | null): string {
  if (!fim) return "em andamento";
  const s = Math.round((fim.getTime() - inicio.getTime()) / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${s % 60} s` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Página atual a partir de searchParams (1-based, saneada). */
export function paginaDe(valor: string | string[] | undefined): number {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}
