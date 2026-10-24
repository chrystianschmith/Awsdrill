/**
 * Servidor falso e mínimo da API do Stripe para os testes e2e (sem rede).
 *
 * O app aponta para cá com STRIPE_API_BASE. Responde só aos endpoints que o
 * app usa e simula as páginas hospedadas:
 * - GET /checkout/:id  → "paga" a sessão, envia os webhooks assinados ao app
 *   e redireciona para a success_url;
 * - GET /portal/:id    → portal do cliente com "Cancelar assinatura" (imediato,
 *   customer.subscription.deleted) e "Cancelar no fim do período"
 *   (customer.subscription.updated).
 *
 * Estado só em memória. Rodar: `npx tsx tests/e2e/apoio/stripe-mock.ts`.
 */
import { randomBytes } from "node:crypto";
import http from "node:http";
import Stripe from "stripe";
import { PORTA_STRIPE_MOCK, URL_APP, URL_STRIPE_MOCK, WEBHOOK_SECRET_E2E } from "./constantes";

type Obj = Record<string, unknown>;
type Form = { [k: string]: string | Form };

const PORTA = Number(process.env.STRIPE_MOCK_PORT ?? PORTA_STRIPE_MOCK);
const BASE = process.env.STRIPE_MOCK_URL ?? URL_STRIPE_MOCK;
const APP = (process.env.APP_URL ?? URL_APP).replace(/\/$/, "");
const SEGREDO = process.env.STRIPE_WEBHOOK_SECRET ?? WEBHOOK_SECRET_E2E;
const VALOR_CENTAVOS: Record<string, number> = {
  price_e2e_mensal: 2990,
  price_e2e_anual: 23900,
  price_e2e_anual_pix: 23900,
};

const stripe = new Stripe("sk_test_mock");

const customers = new Map<string, Obj>();
const sessoes = new Map<string, Obj & { url: string; success_url: string; customer: string; extras: Form }>();
const assinaturas = new Map<string, Obj & { customer: string; status: string }>();
const faturas: Array<Obj & { customer: string }> = [];
const portais = new Map<string, { customer: string; return_url: string }>();
let numeroFatura = 0;

const agoraSeg = () => Math.floor(Date.now() / 1000);
const id = (prefixo: string) => `${prefixo}_e2e${randomBytes(9).toString("hex")}`;

/** `a[b][0][c]=v` → { a: { b: { "0": { c: v } } } } */
function lerForm(corpo: string): Form {
  const raiz: Form = {};
  for (const [chave, valor] of new URLSearchParams(corpo)) {
    const partes = chave.split(/\[|\]\[|\]/).filter(Boolean);
    let alvo = raiz;
    partes.forEach((p, i) => {
      if (i === partes.length - 1) alvo[p] = valor;
      else {
        const prox = alvo[p];
        alvo = typeof prox === "object" ? prox : (alvo[p] = {});
      }
    });
  }
  return raiz;
}

const texto = (v: string | Form | undefined): string | null => (typeof v === "string" ? v : null);
const sub = (v: string | Form | undefined): Form => (typeof v === "object" ? v : {});

function json(res: http.ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, { "content-type": "application/json", "request-id": id("req") });
  res.end(JSON.stringify(corpo));
}

function naoEncontrado(res: http.ServerResponse, oque: string) {
  json(res, 404, { error: { type: "invalid_request_error", code: "resource_missing", message: `No such ${oque}` } });
}

function html(res: http.ServerResponse, status: number, titulo: string, corpo: string) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title></head><body><h1>${titulo}</h1>${corpo}</body></html>`,
  );
}

function redirecionar(res: http.ServerResponse, url: string) {
  res.writeHead(303, { location: url });
  res.end();
}

/** Envia um evento assinado ao webhook do app e exige 2xx. */
async function enviarEvento(tipo: string, objeto: Obj) {
  const evento = {
    id: id("evt"),
    object: "event",
    api_version: "2026-09-30.endive",
    created: agoraSeg(),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: tipo,
    data: { object: objeto },
  };
  const payload = JSON.stringify(evento);
  const assinatura = stripe.webhooks.generateTestHeaderString({ payload, secret: SEGREDO });
  const r = await fetch(`${APP}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": assinatura },
    body: payload,
  });
  if (!r.ok) throw new Error(`webhook ${tipo} respondeu ${r.status}: ${await r.text()}`);
}

function novaFatura(
  assinatura: Obj & { customer: string },
  priceId: string,
  trial: boolean,
): Obj & { customer: string } {
  numeroFatura++;
  const valor = trial ? 0 : (VALOR_CENTAVOS[priceId] ?? 0);
  const fatura = {
    id: id("in"),
    object: "invoice",
    customer: assinatura.customer,
    number: `E2E-${String(numeroFatura).padStart(4, "0")}`,
    created: agoraSeg(),
    status: "paid",
    amount_paid: valor,
    amount_due: valor,
    currency: "brl",
    hosted_invoice_url: `${BASE}/fatura/${numeroFatura}`,
    invoice_pdf: null,
    parent: { type: "subscription_details", subscription_details: { subscription: assinatura.id, metadata: {} } },
  };
  faturas.unshift(fatura);
  return fatura;
}

/** Simula o pagamento da sessão de checkout e avisa o app como o Stripe faria. */
async function pagarSessao(sessao: Obj & { customer: string; extras: Form }) {
  if (sessao.status === "complete") return;
  const priceId = texto(sub(sub(sessao.extras.line_items)["0"]).price) ?? "";
  if (sessao.mode === "subscription") {
    const dadosSub = sub(sessao.extras.subscription_data);
    const diasTrial = Number(texto(dadosSub.trial_period_days) ?? 0);
    const trialEnd = Number(texto(dadosSub.trial_end) ?? 0);
    const inicio = agoraSeg();
    const fim = trialEnd || inicio + (diasTrial ? diasTrial * 86_400 : 30 * 86_400);
    const assinatura = {
      id: id("sub"),
      object: "subscription",
      customer: sessao.customer,
      status: diasTrial || trialEnd ? "trialing" : "active",
      cancel_at_period_end: false,
      cancel_at: null as number | null,
      canceled_at: null as number | null,
      created: inicio,
      metadata: sub(dadosSub.metadata),
      items: {
        object: "list",
        data: [
          {
            id: id("si"),
            object: "subscription_item",
            price: { id: priceId, object: "price" },
            current_period_start: inicio,
            current_period_end: fim,
          },
        ],
      },
    };
    assinaturas.set(assinatura.id, assinatura);
    const fatura = novaFatura(assinatura, priceId, Boolean(diasTrial || trialEnd));
    Object.assign(sessao, {
      status: "complete",
      payment_status: diasTrial || trialEnd ? "no_payment_required" : "paid",
      subscription: assinatura.id,
    });
    await enviarEvento("checkout.session.completed", { ...sessao, extras: undefined });
    await enviarEvento("customer.subscription.created", assinatura);
    await enviarEvento("invoice.paid", fatura);
  } else {
    Object.assign(sessao, { status: "complete", payment_status: "paid" });
    await enviarEvento("checkout.session.completed", { ...sessao, extras: undefined });
  }
}

async function cancelarAgora(assinatura: Obj & { status: string }) {
  Object.assign(assinatura, { status: "canceled", canceled_at: agoraSeg(), cancel_at_period_end: false });
  await enviarEvento("customer.subscription.deleted", assinatura);
}

const VIVOS = new Set(["trialing", "active", "past_due", "unpaid", "incomplete"]);
const vivasDo = (customer: string) =>
  [...assinaturas.values()].filter((a) => a.customer === customer && VIVOS.has(a.status));

function publico(o: Obj): Obj {
  const resto = { ...o };
  delete resto.extras;
  return resto;
}

async function rotear(req: http.IncomingMessage, res: http.ServerResponse, corpo: string) {
  const url = new URL(req.url ?? "/", BASE);
  const metodo = req.method ?? "GET";
  const p = url.pathname.split("/").filter(Boolean);
  const form = lerForm(corpo);

  if (url.pathname === "/health") return json(res, 200, { ok: true });

  // ───────────── API (/v1) ─────────────
  if (p[0] === "v1") {
    const [, recurso, a, b] = p;
    if (recurso === "customers" && !a && metodo === "POST") {
      const c = {
        id: id("cus"),
        object: "customer",
        email: texto(form.email),
        name: texto(form.name),
        metadata: sub(form.metadata),
      };
      customers.set(c.id, c);
      return json(res, 200, c);
    }
    if (recurso === "customers" && a && metodo === "GET") {
      const c = customers.get(a);
      return c ? json(res, 200, c) : naoEncontrado(res, "customer");
    }
    if (recurso === "checkout" && a === "sessions" && !b && metodo === "POST") {
      const sid = `cs_test_${randomBytes(12).toString("hex")}`;
      const s = {
        id: sid,
        object: "checkout.session",
        mode: texto(form.mode) ?? "payment",
        status: "open",
        payment_status: "unpaid",
        client_reference_id: texto(form.client_reference_id),
        customer: texto(form.customer) ?? "",
        subscription: null,
        metadata: sub(form.metadata),
        success_url: (texto(form.success_url) ?? "").replace("{CHECKOUT_SESSION_ID}", sid),
        cancel_url: texto(form.cancel_url),
        url: `${BASE}/checkout/${sid}`,
        extras: form,
      };
      sessoes.set(sid, s);
      return json(res, 200, publico(s));
    }
    if (recurso === "checkout" && a === "sessions" && b && metodo === "GET") {
      const s = sessoes.get(b);
      return s ? json(res, 200, publico(s)) : naoEncontrado(res, "checkout.session");
    }
    if (recurso === "subscriptions" && a) {
      const s = assinaturas.get(a);
      if (!s) return naoEncontrado(res, "subscription");
      if (metodo === "GET") return json(res, 200, s);
      if (metodo === "DELETE") {
        await cancelarAgora(s);
        return json(res, 200, s);
      }
      if (metodo === "POST") {
        const fimPeriodo = texto(form.cancel_at_period_end);
        if (fimPeriodo !== null) s.cancel_at_period_end = fimPeriodo === "true";
        await enviarEvento("customer.subscription.updated", s);
        return json(res, 200, s);
      }
    }
    if (recurso === "billing_portal" && a === "sessions" && metodo === "POST") {
      const customer = texto(form.customer) ?? "";
      const pid = id("bps");
      const retorno = texto(form.return_url) ?? APP;
      portais.set(pid, { customer, return_url: retorno });
      return json(res, 200, {
        id: pid,
        object: "billing_portal.session",
        customer,
        return_url: retorno,
        url: `${BASE}/portal/${pid}`,
      });
    }
    if (recurso === "invoices" && !a && metodo === "GET") {
      const customer = url.searchParams.get("customer");
      const limite = Number(url.searchParams.get("limit") ?? 10);
      const data = faturas.filter((f) => !customer || f.customer === customer).slice(0, limite);
      return json(res, 200, { object: "list", url: "/v1/invoices", has_more: false, data });
    }
    return json(res, 404, {
      error: { type: "invalid_request_error", message: `Mock sem rota para ${metodo} ${url.pathname}` },
    });
  }

  // ───────────── Páginas hospedadas ─────────────
  if (p[0] === "checkout" && p[1] && metodo === "GET") {
    const s = sessoes.get(p[1]);
    if (!s) return html(res, 404, "Sessão de checkout não encontrada", "");
    await pagarSessao(s);
    return redirecionar(res, s.success_url);
  }
  if (p[0] === "portal" && p[1]) {
    const portal = portais.get(p[1]);
    if (!portal) return html(res, 404, "Portal não encontrado", "");
    if (metodo === "POST" && p[2] === "cancelar") {
      for (const a of vivasDo(portal.customer)) await cancelarAgora(a);
      return redirecionar(res, portal.return_url);
    }
    if (metodo === "POST" && p[2] === "cancelar-fim") {
      for (const a of vivasDo(portal.customer)) {
        a.cancel_at_period_end = true;
        await enviarEvento("customer.subscription.updated", a);
      }
      return redirecionar(res, portal.return_url);
    }
    const vivas = vivasDo(portal.customer);
    const lista = vivas.length
      ? `<ul>${vivas.map((a) => `<li>${a.id}: ${a.status}${a.cancel_at_period_end ? " (cancela no fim do período)" : ""}</li>`).join("")}</ul>
         <form method="post" action="/portal/${p[1]}/cancelar-fim"><button type="submit">Cancelar no fim do período</button></form>
         <form method="post" action="/portal/${p[1]}/cancelar"><button type="submit">Cancelar assinatura</button></form>`
      : "<p>Nenhuma assinatura ativa.</p>";
    return html(res, 200, "Portal do cliente (teste)", `${lista}<p><a href="${portal.return_url}">Voltar</a></p>`);
  }
  if (p[0] === "fatura") return html(res, 200, `Fatura ${p[1] ?? ""}`, "<p>Fatura de teste.</p>");
  return html(res, 404, "Não encontrado", "");
}

const servidor = http.createServer((req, res) => {
  let corpo = "";
  req.setEncoding("utf8");
  req.on("data", (c: string) => (corpo += c));
  req.on("end", () => {
    rotear(req, res, corpo).catch((erro: unknown) => {
      const msg = erro instanceof Error ? erro.message : String(erro);
      console.error(`[stripe-mock] ${req.method} ${req.url}: ${msg}`);
      if (!res.headersSent) html(res, 500, "Erro no Stripe de teste", `<pre>${msg.replace(/</g, "&lt;")}</pre>`);
    });
  });
});

servidor.listen(PORTA, () => console.log(`[stripe-mock] ouvindo em ${BASE}`));
