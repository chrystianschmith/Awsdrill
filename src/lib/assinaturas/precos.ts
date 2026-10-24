/**
 * Catálogo de preços do Pro (em centavos de BRL). É a referência para a página
 * de preços e para `scripts/stripe/setup.ts`, que cria os preços no Stripe com
 * estes valores e `lookup_key`s.
 */
export const INTERVALOS = ["MENSAL", "ANUAL", "ANUAL_PIX"] as const;
export type Intervalo = (typeof INTERVALOS)[number];

export type PrecoPro = {
  intervalo: Intervalo;
  lookupKey: string;
  centavos: number;
  /** Recorrente no cartão (assinatura) ou pagamento único via Pix. */
  tipo: "assinatura" | "pagamento_unico";
  recorrencia: "month" | "year" | null;
  rotulo: string;
};

export const PRECOS: Record<Intervalo, PrecoPro> = {
  MENSAL: {
    intervalo: "MENSAL",
    lookupKey: "pro_mensal_brl",
    centavos: 2990,
    tipo: "assinatura",
    recorrencia: "month",
    rotulo: "Mensal no cartão",
  },
  ANUAL: {
    intervalo: "ANUAL",
    lookupKey: "pro_anual_brl",
    centavos: 23900,
    tipo: "assinatura",
    recorrencia: "year",
    rotulo: "Anual no cartão",
  },
  ANUAL_PIX: {
    intervalo: "ANUAL_PIX",
    lookupKey: "pro_anual_pix_brl",
    centavos: 23900,
    tipo: "pagamento_unico",
    recorrencia: null,
    rotulo: "Anual via Pix",
  },
};

/** Meses de acesso concedidos por um pagamento anual via Pix. */
export const MESES_PIX = 12;
/** Dias de carência após falha de pagamento no cartão. */
export const DIAS_CARENCIA = 3;
/** Antecedência do lembrete de renovação do Pix. */
export const DIAS_LEMBRETE_PIX = 7;

/** Economia do anual em relação a 12 mensalidades, em centavos. */
export function economiaAnualCentavos(precos: Record<Intervalo, PrecoPro> = PRECOS): number {
  return Math.max(0, precos.MENSAL.centavos * 12 - precos.ANUAL.centavos);
}

/** Valor mensal equivalente do plano anual, em centavos (arredondado). */
export function mensalEquivalenteAnualCentavos(precos: Record<Intervalo, PrecoPro> = PRECOS): number {
  return Math.round(precos.ANUAL.centavos / 12);
}
