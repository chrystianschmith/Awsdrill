import "server-only";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { BRAND } from "@/lib/brand";
import type { Intervalo } from "./precos";
import { STRIPE_API_VERSION } from "./stripe-versao";
import { destinoApiStripe } from "./stripe-destino";

export { STRIPE_API_VERSION };

let cliente: Stripe | null = null;

export function stripeConfigurado(): boolean {
  return Boolean(env().STRIPE_SECRET_KEY);
}

/** Cliente Stripe criado sob demanda; sem STRIPE_SECRET_KEY lança erro amigável. */
export function getStripe(): Stripe {
  const chave = env().STRIPE_SECRET_KEY;
  if (!chave)
    throw new AppError("Pagamentos indisponíveis no momento. Tente novamente mais tarde.", "stripe_desconfigurado");
  cliente ??= new Stripe(chave, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    appInfo: { name: BRAND.name },
    ...destinoApiStripe(),
  });
  return cliente;
}

/** ID do preço no Stripe para o intervalo escolhido (variáveis STRIPE_PRICE_*). */
export function priceIdPara(intervalo: Intervalo): string {
  const e = env();
  const id = { MENSAL: e.STRIPE_PRICE_MENSAL, ANUAL: e.STRIPE_PRICE_ANUAL, ANUAL_PIX: e.STRIPE_PRICE_ANUAL_PIX }[
    intervalo
  ];
  if (!id) throw new AppError("Este plano não está disponível no momento.", "preco_desconfigurado");
  return id;
}

/** Intervalo a partir do priceId gravado na assinatura (null se desconhecido). */
export function intervaloDoPrice(priceId: string | null): Intervalo | null {
  if (!priceId) return null;
  const e = env();
  if (priceId === e.STRIPE_PRICE_MENSAL) return "MENSAL";
  if (priceId === e.STRIPE_PRICE_ANUAL) return "ANUAL";
  if (priceId === e.STRIPE_PRICE_ANUAL_PIX) return "ANUAL_PIX";
  return null;
}

/**
 * Customer do Stripe do usuário, reaproveitado entre checkouts. Cria um novo
 * (com chave de idempotência) e a linha de Subscription na primeira vez.
 */
export async function getOrCreateCustomer(user: { id: string; email: string; name: string }): Promise<string> {
  const existente = await db.subscription.findUnique({
    where: { userId: user.id },
    select: { stripeCustomerId: true },
  });
  if (existente) return existente.stripeCustomerId;

  const customer = await getStripe().customers.create(
    { email: user.email, name: user.name, metadata: { userId: user.id } },
    { idempotencyKey: `customer-${user.id}` },
  );
  const linha = await db.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, stripeCustomerId: customer.id },
    update: {},
    select: { stripeCustomerId: true },
  });
  return linha.stripeCustomerId;
}
