"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { requireUser } from "@/lib/auth/session";
import { LIMITES, RateLimitError, exigirLimite } from "@/lib/auth/rate-limit";
import { getEffectivePlan } from "./plano";
import { INTERVALOS } from "./precos";
import { STATUS_VIVOS, trialAteFimDoPix } from "./regras";
import { getOrCreateCustomer, getStripe, priceIdPara } from "./stripe";
import { TIPO_PIX_ANUAL } from "./webhook";

export type DestinoCheckout = { url: string; destino: "checkout" | "portal" };
export type EstadoCheckout = "confirmado" | "pendente" | "aguardando_pix" | "expirado";

const intervaloSchema = z.enum(INTERVALOS);
const sessaoSchema = z
  .string()
  .regex(/^cs_[A-Za-z0-9_]+$/)
  .max(255);

function erroParaResultado(erro: unknown, evento: string): ActionResult<never> {
  if (erro instanceof RateLimitError) return fail(erro.message, "rate_limit");
  if (erro instanceof AppError) return fail(erro.message, erro.code);
  log("error", evento, { erro: erro instanceof Error ? erro.message : String(erro) });
  return fail("Não foi possível falar com o sistema de pagamentos. Tente novamente em instantes.");
}

async function urlPortal(customer: string): Promise<string> {
  const sessao = await getStripe().billingPortal.sessions.create({
    customer,
    return_url: `${env().APP_URL}/conta/assinatura`,
    locale: "pt-BR",
  });
  return sessao.url;
}

/**
 * Inicia o Stripe Checkout hospedado. Cartão: assinatura mensal ou anual.
 * Pix: pagamento único anual. Quem já tem assinatura no cartão vai ao portal.
 */
export async function iniciarCheckout(intervalo: unknown): Promise<ActionResult<DestinoCheckout>> {
  const user = await requireUser();
  const parsed = intervaloSchema.safeParse(intervalo);
  if (!parsed.success) return fail("Plano inválido.", "validacao");

  try {
    await exigirLimite(`checkout:${user.id}`, LIMITES.checkoutUsuario);
    const atual = await db.subscription.findUnique({
      where: { userId: user.id },
      select: { stripeCustomerId: true, stripeSubscriptionId: true, status: true, accessUntil: true },
    });
    if (atual?.stripeSubscriptionId && atual.status && STATUS_VIVOS.has(atual.status)) {
      return ok({ url: await urlPortal(atual.stripeCustomerId), destino: "portal" });
    }

    const customer = await getOrCreateCustomer(user);
    const stripe = getStripe();
    const { APP_URL, STRIPE_TRIAL_DAYS } = env();
    const comum = {
      customer,
      client_reference_id: user.id,
      line_items: [{ price: priceIdPara(parsed.data), quantity: 1 }],
      success_url: `${APP_URL}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/checkout/cancelado`,
      locale: "pt-BR" as const,
    };

    if (parsed.data === "ANUAL_PIX") {
      const metadata = { userId: user.id, tipo: TIPO_PIX_ANUAL };
      const sessao = await stripe.checkout.sessions.create({
        ...comum,
        mode: "payment",
        allowed_payment_method_types: ["pix"],
        metadata,
        payment_intent_data: { metadata },
        invoice_creation: { enabled: true, invoice_data: { metadata } },
      });
      if (!sessao.url) throw new Error("Sessão de checkout sem URL");
      return ok({ url: sessao.url, destino: "checkout" });
    }

    // Quem ainda tem acesso pago via Pix só começa a pagar no cartão quando ele acabar.
    const agora = new Date();
    const trialEnd = trialAteFimDoPix(atual?.accessUntil ?? null, agora);
    const primeiraVez = !atual?.stripeSubscriptionId && !atual?.accessUntil;
    const sessao = await stripe.checkout.sessions.create({
      ...comum,
      mode: "subscription",
      allowed_payment_method_types: ["card"],
      metadata: { userId: user.id },
      subscription_data: {
        metadata: { userId: user.id },
        ...(trialEnd
          ? { trial_end: trialEnd }
          : primeiraVez && STRIPE_TRIAL_DAYS > 0
            ? { trial_period_days: STRIPE_TRIAL_DAYS }
            : {}),
      },
    });
    if (!sessao.url) throw new Error("Sessão de checkout sem URL");
    return ok({ url: sessao.url, destino: "checkout" });
  } catch (erro) {
    return erroParaResultado(erro, "checkout.falhou");
  }
}

/** Abre o portal do cliente do Stripe (trocar plano, cartão, cancelar, faturas). */
export async function abrirPortal(): Promise<ActionResult<DestinoCheckout>> {
  const user = await requireUser();
  try {
    await exigirLimite(`portal:${user.id}`, LIMITES.checkoutUsuario);
    const atual = await db.subscription.findUnique({ where: { userId: user.id }, select: { stripeCustomerId: true } });
    if (!atual) return fail("Você ainda não tem uma assinatura para gerenciar.", "sem_assinatura");
    return ok({ url: await urlPortal(atual.stripeCustomerId), destino: "portal" });
  } catch (erro) {
    return erroParaResultado(erro, "portal.falhou");
  }
}

/**
 * Status da sessão de checkout para a página de sucesso. Só lê: o Pro é
 * liberado exclusivamente pelo webhook.
 */
export async function consultarStatusCheckout(sessionId: unknown): Promise<ActionResult<{ estado: EstadoCheckout }>> {
  const user = await requireUser();
  const parsed = sessaoSchema.safeParse(sessionId);
  if (!parsed.success) return fail("Sessão de pagamento inválida.", "validacao");

  try {
    const sessao = await getStripe().checkout.sessions.retrieve(parsed.data);
    if (sessao.client_reference_id !== user.id) return fail("Sessão de pagamento não encontrada.", "nao_encontrada");
    if (sessao.status === "expired") return ok({ estado: "expirado" });

    const { plan } = await getEffectivePlan(user.id);
    if (sessao.mode === "payment") {
      const concedido = await db.stripeEvent.count({ where: { id: `pix:${sessao.id}` } });
      if (concedido > 0 && plan === "PRO") return ok({ estado: "confirmado" });
      return ok({ estado: sessao.payment_status === "paid" ? "pendente" : "aguardando_pix" });
    }

    const subId = typeof sessao.subscription === "string" ? sessao.subscription : (sessao.subscription?.id ?? null);
    const local = await db.subscription.findUnique({
      where: { userId: user.id },
      select: { stripeSubscriptionId: true },
    });
    if (plan === "PRO" && subId && local?.stripeSubscriptionId === subId) return ok({ estado: "confirmado" });
    return ok({ estado: "pendente" });
  } catch (erro) {
    return erroParaResultado(erro, "checkout.status_falhou");
  }
}
