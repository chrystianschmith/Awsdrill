import { INTERVALOS, type Intervalo } from "./precos";

/**
 * Funil de venda: o plano escolhido na página de vendas viaja pela URL
 * (`?plano=anual`) pelo login até o início do checkout.
 */
export function planoDaUrl(valor: unknown): Intervalo | null {
  if (typeof valor !== "string") return null;
  const v = valor.trim().toUpperCase();
  return (INTERVALOS as readonly string[]).includes(v) ? (v as Intervalo) : null;
}

/** Página que abre o checkout do Stripe para o plano (exige login). */
export function urlIniciarCheckout(intervalo: Intervalo): string {
  return `/checkout/iniciar?plano=${intervalo.toLowerCase()}`;
}

/** Login (com link para o cadastro) que volta para o checkout do plano escolhido. */
export function urlEntrarComPlano(intervalo: Intervalo): string {
  return `/entrar?voltar=${encodeURIComponent(urlIniciarCheckout(intervalo))}`;
}
