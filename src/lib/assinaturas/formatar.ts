import { TZ } from "@/lib/estudo/tempo";

const dataLonga = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

/** "8 de outubro de 2026" no fuso de São Paulo. */
export function formatarDataLonga(d: Date): string {
  return dataLonga.format(d);
}

/** "08/10/2026" no fuso de São Paulo. */
export function formatarDataCurta(d: Date): string {
  return dataCurta.format(d);
}

const STATUS: Record<string, string> = {
  trialing: "Em período de teste",
  active: "Ativa",
  past_due: "Pagamento pendente",
  unpaid: "Não paga",
  canceled: "Cancelada",
  incomplete: "Aguardando pagamento",
  incomplete_expired: "Expirada",
  paused: "Pausada",
};

export function rotuloStatus(status: string | null): string {
  return status ? (STATUS[status] ?? status) : "Sem assinatura no cartão";
}
