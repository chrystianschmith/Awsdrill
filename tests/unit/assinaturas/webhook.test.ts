import { beforeEach, describe, expect, it } from "vitest";
import {
  assinaturaDaFatura,
  mapearEvento,
  processarEvento,
  snapshotDe,
  type CheckoutSessionLike,
  type EventoLike,
  type StripeLike,
  type SubscriptionLike,
} from "@/lib/assinaturas/webhook";
import { RepoMemoria, caixaDeEmails } from "./repo-memoria";

const agora = new Date("2026-10-08T12:00:00Z");
const fimPeriodo = Math.floor(new Date("2026-11-08T12:00:00Z").getTime() / 1000);

function assinatura(status: string, extra: Partial<SubscriptionLike> = {}): SubscriptionLike {
  return {
    id: "sub_1",
    status,
    customer: "cus_1",
    cancel_at_period_end: false,
    cancel_at: null,
    metadata: { userId: "u1" },
    items: { data: [{ price: { id: "price_mensal" }, current_period_end: fimPeriodo }] },
    ...extra,
  };
}

class StripeFalso implements StripeLike {
  subs = new Map<string, SubscriptionLike>();
  sessoes = new Map<string, CheckoutSessionLike>();
  chamadas = 0;
  subscriptions = {
    retrieve: async (id: string) => {
      this.chamadas++;
      const s = this.subs.get(id);
      if (!s) throw new Error(`assinatura ${id} inexistente`);
      return s;
    },
  };
  checkout = {
    sessions: {
      retrieve: async (id: string) => {
        this.chamadas++;
        const s = this.sessoes.get(id);
        if (!s) throw new Error(`sessão ${id} inexistente`);
        return s;
      },
    },
  };
}

const evento = (id: string, type: string, object: unknown): EventoLike => ({ id, type, data: { object } });
const faturaDe = (sub: string) => ({ id: "in_1", parent: { subscription_details: { subscription: sub } } });

let repo: RepoMemoria;
let stripe: StripeFalso;
let caixa: ReturnType<typeof caixaDeEmails>;
const processar = (e: EventoLike, quando: Date = agora) =>
  processarEvento(e, { stripe, repo, enviarEmail: caixa.enviar, agora: () => quando });

beforeEach(async () => {
  repo = new RepoMemoria();
  stripe = new StripeFalso();
  caixa = caixaDeEmails();
  // Linha criada por getOrCreateCustomer antes do checkout.
  await repo.salvar("u1", "cus_1", {});
  repo.seguir("u1", "e1", new Date("2026-01-01T00:00:00Z"));
});

describe("mapeamento de eventos", () => {
  it("snapshot usa o maior fim de período dos itens e cancel_at", () => {
    const s = snapshotDe(assinatura("active", { cancel_at: fimPeriodo }));
    expect(s).toEqual({
      id: "sub_1",
      status: "active",
      priceId: "price_mensal",
      currentPeriodEnd: new Date(fimPeriodo * 1000),
      cancelAtPeriodEnd: true,
    });
  });

  it("extrai a assinatura da fatura (parent.subscription_details)", () => {
    expect(assinaturaDaFatura(faturaDe("sub_9"))).toBe("sub_9");
    expect(assinaturaDaFatura({ parent: { subscription_details: { subscription: { id: "sub_8" } } } })).toBe("sub_8");
    expect(assinaturaDaFatura({ parent: null })).toBeNull();
  });

  it("evento de assinatura busca o estado atual na API, não o do payload", async () => {
    stripe.subs.set("sub_1", assinatura("canceled"));
    const m = await mapearEvento(
      evento("evt_1", "customer.subscription.updated", { id: "sub_1", status: "active" }),
      stripe,
    );
    expect(m).toMatchObject({ tipo: "sincronizar", assinatura: { status: "canceled" }, carencia: "manter" });
  });

  it("payment_failed inicia carência e invoice.paid limpa", async () => {
    stripe.subs.set("sub_1", assinatura("past_due"));
    expect(await mapearEvento(evento("e", "invoice.payment_failed", faturaDe("sub_1")), stripe)).toMatchObject({
      carencia: "iniciar",
    });
    expect(await mapearEvento(evento("e", "invoice.paid", faturaDe("sub_1")), stripe)).toMatchObject({
      carencia: "limpar",
    });
  });

  it("Pix ainda não pago é ignorado; pago vira concessão", async () => {
    const sessao: CheckoutSessionLike = {
      id: "cs_pix",
      mode: "payment",
      client_reference_id: "u1",
      customer: "cus_1",
      subscription: null,
      payment_status: "unpaid",
      metadata: { userId: "u1", tipo: "pix_anual" },
    };
    stripe.sessoes.set("cs_pix", sessao);
    expect((await mapearEvento(evento("e", "checkout.session.completed", { id: "cs_pix" }), stripe)).tipo).toBe(
      "ignorar",
    );
    stripe.sessoes.set("cs_pix", { ...sessao, payment_status: "paid" });
    expect(
      await mapearEvento(evento("e", "checkout.session.async_payment_succeeded", { id: "cs_pix" }), stripe),
    ).toEqual({
      tipo: "pix",
      userId: "u1",
      customerId: "cus_1",
      sessionId: "cs_pix",
    });
  });

  it("eventos não tratados não consultam a API", async () => {
    expect((await mapearEvento(evento("e", "charge.refunded", { id: "ch_1" }), stripe)).tipo).toBe("ignorar");
    expect(stripe.chamadas).toBe(0);
  });
});

describe("processarEvento", () => {
  it("checkout de assinatura libera o Pro, audita e envia um e-mail", async () => {
    stripe.subs.set("sub_1", assinatura("trialing"));
    stripe.sessoes.set("cs_1", {
      id: "cs_1",
      mode: "subscription",
      client_reference_id: "u1",
      customer: "cus_1",
      subscription: "sub_1",
      payment_status: "no_payment_required",
      metadata: { userId: "u1" },
    });
    expect(await processar(evento("evt_1", "checkout.session.completed", { id: "cs_1" }))).toBe("processado");

    const sub = await repo.porUsuario("u1");
    expect(sub).toMatchObject({ stripeSubscriptionId: "sub_1", status: "trialing", effectivePlan: "PRO" });
    expect(caixa.enviados).toEqual([
      { tipo: "ativada", userId: "u1", via: "cartao", acessoAte: new Date(fimPeriodo * 1000) },
    ]);
    expect(repo.estado.auditoria.map((a) => a.action)).toEqual(["assinatura.status", "assinatura.plano_alterado"]);
  });

  it("é idempotente: o mesmo evento 2x não duplica efeito nem e-mail", async () => {
    stripe.subs.set("sub_1", assinatura("past_due"));
    await repo.salvar("u1", "cus_1", { stripeSubscriptionId: "sub_1", status: "active", effectivePlan: "PRO" });
    const e = evento("evt_falha", "invoice.payment_failed", faturaDe("sub_1"));

    expect(await processar(e)).toBe("processado");
    const depoisDoPrimeiro = await repo.porUsuario("u1");
    const auditoria = repo.estado.auditoria.length;

    // Reentrega um dia depois: não pode empurrar a carência nem reenviar e-mail.
    expect(await processar(e, new Date(agora.getTime() + 86_400_000))).toBe("duplicado");
    expect(await repo.porUsuario("u1")).toEqual(depoisDoPrimeiro);
    expect(repo.estado.auditoria).toHaveLength(auditoria);
    expect(caixa.enviados).toEqual([
      { tipo: "pagamento_falhou", userId: "u1", graceUntil: new Date(agora.getTime() + 3 * 86_400_000) },
    ]);
  });

  it("evento registrado por outra entrega concorrente dentro da transação é duplicado", async () => {
    stripe.subs.set("sub_1", assinatura("active"));
    const e = evento("evt_c", "customer.subscription.updated", { id: "sub_1" });
    // Simula a corrida: a checagem rápida passa, mas outra entrega grava o id antes.
    const original = repo.eventoProcessado.bind(repo);
    repo.eventoProcessado = async (id) => {
      const r = await original(id);
      await repo.registrarEvento(id, "outra-entrega");
      return r;
    };
    expect(await processar(e)).toBe("duplicado");
    expect((await repo.porUsuario("u1"))?.status).toBeNull();
  });

  it("erro na API do Stripe sobe (rota responde 500) sem gravar o evento", async () => {
    const e = evento("evt_x", "customer.subscription.updated", { id: "sub_inexistente" });
    await expect(processar(e)).rejects.toThrow();
    expect(await repo.eventoProcessado("evt_x")).toBe(false);
  });

  it("falha dentro da transação desfaz o registro do evento", async () => {
    stripe.subs.set("sub_1", assinatura("active"));
    repo.auditar = async () => {
      throw new Error("banco caiu");
    };
    await expect(processar(evento("evt_t", "customer.subscription.updated", { id: "sub_1" }))).rejects.toThrow(
      "banco caiu",
    );
    expect(await repo.eventoProcessado("evt_t")).toBe(false);
    expect((await repo.porUsuario("u1"))?.status).toBeNull();
  });

  it("invoice.paid limpa a carência", async () => {
    stripe.subs.set("sub_1", assinatura("active"));
    await repo.salvar("u1", "cus_1", {
      stripeSubscriptionId: "sub_1",
      status: "past_due",
      graceUntil: new Date(agora.getTime() + 86_400_000),
      effectivePlan: "PRO",
    });
    await processar(evento("evt_p", "invoice.paid", faturaDe("sub_1")));
    expect((await repo.porUsuario("u1"))?.graceUntil).toBeNull();
    expect(caixa.enviados).toEqual([]);
  });

  it("cancelamento volta ao Grátis, pausa exames extras e avisa", async () => {
    repo.seguir("u1", "e2", new Date("2026-03-01T00:00:00Z"));
    repo.seguir("u1", "e3", new Date("2026-05-01T00:00:00Z"));
    await repo.salvar("u1", "cus_1", { stripeSubscriptionId: "sub_1", status: "active", effectivePlan: "PRO" });
    stripe.subs.set("sub_1", assinatura("canceled"));

    await processar(evento("evt_d", "customer.subscription.deleted", { id: "sub_1" }));
    expect(repo.statusSeguidos("u1")).toEqual({ e1: "ATIVO", e2: "PAUSADO", e3: "PAUSADO" });
    expect(caixa.enviados).toEqual([{ tipo: "voltou_gratis", userId: "u1" }]);
    expect(repo.estado.auditoria.at(-1)).toMatchObject({
      action: "assinatura.plano_alterado",
      metadata: { de: "PRO", para: "FREE", examesPausados: 2 },
    });
  });

  it("evento atrasado de assinatura antiga cancelada não derruba a atual", async () => {
    await repo.salvar("u1", "cus_1", { stripeSubscriptionId: "sub_novo", status: "active", effectivePlan: "PRO" });
    stripe.subs.set("sub_1", assinatura("canceled"));
    await processar(evento("evt_old", "customer.subscription.deleted", { id: "sub_1" }));
    expect(await repo.porUsuario("u1")).toMatchObject({ stripeSubscriptionId: "sub_novo", status: "active" });
  });

  it("Pix pago concede 12 meses uma única vez, mesmo com dois eventos", async () => {
    stripe.sessoes.set("cs_pix", {
      id: "cs_pix",
      mode: "payment",
      client_reference_id: "u1",
      customer: "cus_1",
      subscription: null,
      payment_status: "paid",
      metadata: { userId: "u1", tipo: "pix_anual" },
    });
    await processar(evento("evt_a", "checkout.session.completed", { id: "cs_pix" }));
    await processar(evento("evt_b", "checkout.session.async_payment_succeeded", { id: "cs_pix" }));

    const sub = await repo.porUsuario("u1");
    expect(sub?.accessUntil).toEqual(new Date("2027-10-08T12:00:00Z"));
    expect(sub?.effectivePlan).toBe("PRO");
    expect(caixa.enviados.filter((e) => e.tipo === "ativada")).toHaveLength(1);
  });

  it("renovação via Pix soma ao acesso vigente e rearma o lembrete", async () => {
    await repo.salvar("u1", "cus_1", {
      accessUntil: new Date("2026-10-12T00:00:00Z"),
      renewalReminderSentAt: new Date("2026-10-05T00:00:00Z"),
      effectivePlan: "PRO",
    });
    stripe.sessoes.set("cs_pix2", {
      id: "cs_pix2",
      mode: "payment",
      client_reference_id: "u1",
      customer: "cus_1",
      subscription: null,
      payment_status: "paid",
      metadata: { userId: "u1", tipo: "pix_anual" },
    });
    await processar(evento("evt_r", "checkout.session.completed", { id: "cs_pix2" }));
    const sub = await repo.porUsuario("u1");
    expect(sub?.accessUntil).toEqual(new Date("2027-10-12T00:00:00Z"));
    expect(sub?.renewalReminderSentAt).toBeNull();
  });

  it("eventos não tratados são ignorados sem tocar no banco", async () => {
    expect(await processar(evento("evt_n", "charge.succeeded", { id: "ch_1" }))).toBe("ignorado");
    expect(await repo.eventoProcessado("evt_n")).toBe(false);
  });
});
