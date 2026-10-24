import "server-only";
import { db } from "@/lib/db";
import {
  ENTITLEMENTS,
  UpgradeRequiredError,
  resolvePlanForUser,
  type BooleanFeature,
  type EffectivePlan,
  type Entitlements,
  type PlanKey,
} from "./entitlements";

export async function getEffectivePlan(userId: string): Promise<EffectivePlan> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, subscription: { select: { status: true, graceUntil: true, accessUntil: true } } },
  });
  return resolvePlanForUser(user?.role ?? "USER", user?.subscription ?? null);
}

export async function getPlan(userId: string): Promise<PlanKey> {
  return (await getEffectivePlan(userId)).plan;
}

/** O plano do usuário libera o recurso? (para a UI e regras que só pulam um passo) */
export async function temRecurso(userId: string, feature: BooleanFeature): Promise<boolean> {
  return ENTITLEMENTS[await getPlan(userId)][feature];
}

/** Lança UpgradeRequiredError se o plano do usuário não libera o recurso. */
export async function assertEntitlement(userId: string, feature: BooleanFeature): Promise<void> {
  const plan = await getPlan(userId);
  if (!ENTITLEMENTS[plan][feature]) throw new UpgradeRequiredError(feature);
}

/** Valor numérico do plano do usuário (ex.: exames seguidos, treinos por semana). */
export async function limiteDoPlano<K extends keyof Entitlements>(userId: string, chave: K): Promise<Entitlements[K]> {
  return ENTITLEMENTS[await getPlan(userId)][chave];
}

/** Tem direito aos dias grátis do cartão: nunca assinou nem pagou via Pix (mesma regra do checkout). */
export async function elegivelAoTrial(userId: string): Promise<boolean> {
  const atual = await db.subscription.findUnique({
    where: { userId },
    select: { stripeSubscriptionId: true, accessUntil: true },
  });
  return !atual?.stripeSubscriptionId && !atual?.accessUntil;
}
