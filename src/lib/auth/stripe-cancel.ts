import "server-only";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { getStripe, stripeConfigurado } from "@/lib/assinaturas/stripe";

const ENCERRADAS = new Set(["canceled", "incomplete_expired"]);

/**
 * Cancela imediatamente a assinatura do usuário no Stripe (exclusão de conta).
 * Sem STRIPE_SECRET_KEY ou sem assinatura recorrente, não faz nada.
 * Lança erro se o Stripe recusar, para a exclusão não seguir com cobrança ativa.
 */
export async function cancelarAssinaturaDoUsuario(
  userId: string,
): Promise<"cancelada" | "sem-assinatura" | "sem-stripe"> {
  const sub = await db.subscription.findUnique({
    where: { userId },
    select: { stripeSubscriptionId: true, status: true },
  });
  if (!sub?.stripeSubscriptionId || (sub.status && ENCERRADAS.has(sub.status))) return "sem-assinatura";

  if (!stripeConfigurado()) {
    log("warn", "conta.exclusao.sem_stripe", { userId });
    return "sem-stripe";
  }

  const stripe = getStripe();
  try {
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
  } catch (e) {
    // Assinatura já inexistente no Stripe: nada a cancelar.
    if (e instanceof Stripe.errors.StripeInvalidRequestError && e.code === "resource_missing") return "sem-assinatura";
    log("error", "conta.exclusao.stripe_falhou", { userId, erro: e instanceof Error ? e.message : String(e) });
    throw new Error("Não foi possível cancelar sua assinatura agora. Tente novamente em alguns minutos.");
  }
  return "cancelada";
}
