import "server-only";
import { db } from "@/lib/db";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { PlanKey } from "./entitlements";
import type { AssinaturaRepo, AssinaturaRow, AssinaturaTx } from "./tipos";

type Cliente = PrismaClient | Prisma.TransactionClient;

const selecao = {
  userId: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  status: true,
  priceId: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  graceUntil: true,
  accessUntil: true,
  renewalReminderSentAt: true,
  effectivePlan: true,
} satisfies Prisma.SubscriptionSelect;

type Linha = Prisma.SubscriptionGetPayload<{ select: typeof selecao }>;

function paraRow(l: Linha | null): AssinaturaRow | null {
  if (!l) return null;
  const effectivePlan: PlanKey = l.effectivePlan === "PRO" ? "PRO" : "FREE";
  return { ...l, effectivePlan };
}

function operacoes(c: Cliente): AssinaturaTx {
  return {
    async registrarEvento(id, type) {
      // ON CONFLICT DO NOTHING: em entregas concorrentes, a segunda espera a
      // primeira e recebe count 0, sem abortar a transação.
      const { count } = await c.stripeEvent.createMany({ data: [{ id, type }], skipDuplicates: true });
      return count === 1;
    },
    async porUsuario(userId) {
      return paraRow(await c.subscription.findUnique({ where: { userId }, select: selecao }));
    },
    async porCustomer(stripeCustomerId) {
      return paraRow(await c.subscription.findUnique({ where: { stripeCustomerId }, select: selecao }));
    },
    async salvar(userId, stripeCustomerId, dados) {
      await c.subscription.upsert({
        where: { userId },
        create: { userId, stripeCustomerId, ...dados },
        update: { stripeCustomerId, ...dados },
      });
    },
    async seguidos(userId) {
      return c.userExam.findMany({ where: { userId }, select: { id: true, status: true, createdAt: true } });
    },
    async definirStatusSeguidos(ids, status) {
      await c.userExam.updateMany({ where: { id: { in: ids } }, data: { status } });
    },
    async auditar(action, userId, metadata) {
      await c.auditLog.create({ data: { action, userId, metadata } });
    },
  };
}

/** Repositório de assinaturas sobre o Prisma. */
export const repoPrisma: AssinaturaRepo = {
  ...operacoes(db),
  async eventoProcessado(id) {
    return (await db.stripeEvent.count({ where: { id } })) > 0;
  },
  transacao(fn) {
    return db.$transaction((tx) => fn(operacoes(tx)), { timeout: 15_000 });
  },
  async candidatosPlano(agora) {
    const linhas = await db.subscription.findMany({
      where: {
        OR: [
          { effectivePlan: "PRO" },
          { status: { in: ["trialing", "active", "past_due"] } },
          { accessUntil: { gt: agora } },
        ],
      },
      select: { userId: true },
    });
    return linhas.map((l) => l.userId);
  },
  async candidatosLembretePix(agora, ate) {
    const linhas = await db.subscription.findMany({
      where: { accessUntil: { gt: agora, lte: ate }, renewalReminderSentAt: null },
      select: selecao,
    });
    return linhas.map((l) => paraRow(l)).filter((l): l is AssinaturaRow => l !== null);
  },
  async querAvisosPagamento(userId) {
    const pref = await db.notificationPreference.findUnique({ where: { userId }, select: { avisosPagamento: true } });
    return pref?.avisosPagamento ?? true;
  },
};
