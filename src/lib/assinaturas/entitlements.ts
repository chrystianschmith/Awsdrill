import { AppError } from "@/lib/errors";

/**
 * Fonte única do que cada plano libera. Todo bloqueio de funcionalidade passa
 * por aqui; a UI apenas reflete o resultado.
 */
export const ENTITLEMENTS = {
  FREE: {
    maxExamesSeguidos: 1,
    treinosPorSemana: 5,
    modoProva: false,
    prontidaoPorDominio: false,
    conteudoIA: false,
    cicloEstudos: false,
    revisaoEspacada: false,
  },
  PRO: {
    maxExamesSeguidos: Infinity,
    treinosPorSemana: Infinity,
    modoProva: true,
    prontidaoPorDominio: true,
    conteudoIA: true,
    cicloEstudos: true,
    revisaoEspacada: true,
  },
} as const;

export type PlanKey = keyof typeof ENTITLEMENTS;
export type Entitlements = (typeof ENTITLEMENTS)[PlanKey];
export type BooleanFeature = {
  [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never;
}[keyof Entitlements];

/** Rótulos usados na página de preços e nos CTAs de upgrade. */
export const FEATURE_LABELS: Record<keyof Entitlements, string> = {
  maxExamesSeguidos: "Exames seguidos",
  treinosPorSemana: "Simulados de treino por semana",
  modoProva: "Simulado em modo prova (tempo e tamanho oficiais)",
  prontidaoPorDominio: "Prontidão por domínio e plano de correção",
  conteudoIA: "Resumos, flashcards e questões por tarefa",
  cicloEstudos: "Ciclo de estudos automático",
  revisaoEspacada: "Revisão espaçada (1, 7 e 30 dias)",
};

/** Recurso ou limite do Pro: a UI mostra o convite para assinar (code "upgrade"). */
export class UpgradeRequiredError extends AppError {
  constructor(
    readonly feature: keyof Entitlements,
    mensagem = `Recurso disponível no plano Pro: ${FEATURE_LABELS[feature]}.`,
  ) {
    super(mensagem, "upgrade");
    this.name = "UpgradeRequiredError";
  }
}

export type SubscriptionState = {
  status: string | null;
  graceUntil: Date | null;
  accessUntil: Date | null;
};

export type EffectivePlan = { plan: PlanKey; paymentPending: boolean };

/** Regra de plano efetivo (função pura). */
export function resolvePlan(sub: SubscriptionState | null, now: Date = new Date()): EffectivePlan {
  if (!sub) return { plan: "FREE", paymentPending: false };
  if (sub.status === "trialing" || sub.status === "active") return { plan: "PRO", paymentPending: false };
  if (sub.status === "past_due" && sub.graceUntil && now < sub.graceUntil) {
    return { plan: "PRO", paymentPending: true };
  }
  if (sub.accessUntil && now < sub.accessUntil) return { plan: "PRO", paymentPending: false };
  return { plan: "FREE", paymentPending: false };
}

/** Admin usa tudo do Pro sem assinatura: precisa ver o conteúdo que modera e valida. */
export function resolvePlanForUser(
  role: "USER" | "ADMIN",
  sub: SubscriptionState | null,
  now: Date = new Date(),
): EffectivePlan {
  if (role === "ADMIN") return { plan: "PRO", paymentPending: false };
  return resolvePlan(sub, now);
}

export function entitlementsFor(plan: PlanKey): Entitlements {
  return ENTITLEMENTS[plan];
}
