import { resolvePlan, type SubscriptionState } from "@/lib/assinaturas/entitlements";
import { PRECOS, type Intervalo } from "@/lib/assinaturas/precos";

/*
 * Métricas do painel admin, como funções puras. Sem histórico de status no banco, MRR e churn
 * são estimados a partir do estado atual das assinaturas.
 */

export type AssinaturaMetrica = SubscriptionState & { priceId: string | null };

/** Assinatura que dá acesso Pro e é paga (trial não entra no MRR). */
export function assinaturaPagante(a: AssinaturaMetrica, agora: Date): boolean {
  return resolvePlan(a, agora).plan === "PRO" && a.status !== "trialing";
}

/**
 * MRR estimado em centavos: cada assinatura paga convertida para valor mensal pelo preço do
 * catálogo (anual e Pix anual divididos por 12). priceId desconhecido fica de fora (`semPreco`).
 */
export function calcularMrr(
  assinaturas: readonly AssinaturaMetrica[],
  intervaloDoPrice: (priceId: string | null) => Intervalo | null,
  agora: Date = new Date(),
  precos: Record<Intervalo, { centavos: number }> = PRECOS,
): { mrrCents: number; pagantes: number; emTeste: number; semPreco: number } {
  let mrrCents = 0;
  let pagantes = 0;
  let emTeste = 0;
  let semPreco = 0;
  for (const a of assinaturas) {
    if (a.status === "trialing" && resolvePlan(a, agora).plan === "PRO") emTeste++;
    if (!assinaturaPagante(a, agora)) continue;
    pagantes++;
    const intervalo = intervaloDoPrice(a.priceId);
    if (!intervalo) {
      semPreco++;
      continue;
    }
    const centavos = precos[intervalo].centavos;
    mrrCents += intervalo === "MENSAL" ? centavos : centavos / 12;
  }
  return { mrrCents: Math.round(mrrCents), pagantes, emTeste, semPreco };
}

/**
 * Churn do mês (aproximado): canceladas no mês / (pagantes agora + canceladas no mês).
 * "Pagantes no início do mês" é estimado assim, por falta de histórico.
 */
export function calcularChurn(canceladasNoMes: number, pagantesAgora: number): number {
  const base = pagantesAgora + canceladasNoMes;
  return base === 0 ? 0 : canceladasNoMes / base;
}
