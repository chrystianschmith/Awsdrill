import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

/* Recusas do webhook (seguranca-vibecoding §15): sem assinatura, assinatura inválida, e repetição sem efeito duplo. */

const SEGREDO = "whsec_integracao_teste"; // gitleaks:allow (só teste)
const ids: string[] = [];
let POST: (r: NextRequest) => Promise<Response>;

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_integracao"; // gitleaks:allow (só teste)
  process.env.STRIPE_WEBHOOK_SECRET = SEGREDO;
  ({ POST } = await import("@/app/api/stripe/webhook/route"));
});

afterAll(async () => {
  await db.stripeEvent.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

const pedido = (corpo: string, assinatura?: string) =>
  new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: corpo,
    headers: assinatura ? { "stripe-signature": assinatura } : {},
  });

describe("webhook do Stripe", () => {
  it("recusa sem assinatura e com assinatura inválida", async () => {
    const corpo = JSON.stringify({ id: "evt_x", object: "event", type: "invoice.paid" });
    expect((await POST(pedido(corpo))).status).toBe(400);
    const falsa = Stripe.webhooks.generateTestHeaderString({ payload: corpo, secret: "whsec_outro" });
    expect((await POST(pedido(corpo, falsa))).status).toBe(400);
  });

  it("evento assinado é aceito uma vez; o reenvio não repete o efeito", async () => {
    const id = `evt_integracao_${Date.now()}`;
    ids.push(id);
    const corpo = JSON.stringify({ id, object: "event", type: "customer.created", data: { object: {} } });
    const assinatura = Stripe.webhooks.generateTestHeaderString({ payload: corpo, secret: SEGREDO });
    const r1 = await POST(pedido(corpo, assinatura));
    expect(r1.status).toBe(200);
    const r2 = await POST(pedido(corpo, assinatura));
    expect(r2.status).toBe(200);
    expect(await r2.json()).toMatchObject({ recebido: true });
    expect(await db.stripeEvent.count({ where: { id } })).toBeLessThanOrEqual(1);
  });
});
