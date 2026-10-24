import { randomUUID } from "node:crypto";

/** Assinatura ativa para o `create` aninhado de `User`: o usuário de teste já nasce Pro. */
export const assinaturaPro = () => ({
  create: { stripeCustomerId: `cus_teste_${randomUUID()}`, status: "active", effectivePlan: "PRO" },
});
