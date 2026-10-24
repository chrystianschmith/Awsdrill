import { z } from "zod";
import { log } from "@/lib/log";
import { aplicarPlanoEfetivoCom } from "./plano-efetivo";
import { STATUS_TERMINAIS, calcularAccessUntilPix, calcularCarencia, type AcaoCarencia } from "./regras";
import type { AssinaturaRepo, AssinaturaTx, EmailAssinatura, EnviarEmailAssinatura } from "./tipos";

// ───────────── Formatos mínimos dos objetos do Stripe usados aqui ─────────────
// O cliente real (`Stripe`) satisfaz estes tipos; nos testes basta um objeto falso.

type ComId = { id: string };

export type SubscriptionLike = {
  id: string;
  status: string;
  customer: string | ComId;
  cancel_at_period_end: boolean;
  cancel_at?: number | null;
  metadata: Record<string, string> | null;
  items: { data: Array<{ price: ComId; current_period_end: number }> };
};

export type CheckoutSessionLike = {
  id: string;
  mode: string;
  client_reference_id: string | null;
  customer: string | ComId | null;
  subscription: string | ComId | null;
  payment_status: string;
  metadata: Record<string, string> | null;
};

export type StripeLike = {
  subscriptions: { retrieve(id: string): Promise<SubscriptionLike> };
  checkout: { sessions: { retrieve(id: string): Promise<CheckoutSessionLike> } };
};

export type EventoLike = { id: string; type: string; data: { object: unknown } };

/** Metadado gravado na sessão de checkout do Pix anual. */
export const TIPO_PIX_ANUAL = "pix_anual";

export const EVENTOS_TRATADOS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

// ───────────────────────────── Mapeamento (puro) ─────────────────────────────

export type SnapshotAssinatura = {
  id: string;
  status: string;
  priceId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export type Mudanca =
  | { tipo: "ignorar"; motivo: string }
  | {
      tipo: "sincronizar";
      userIdHint: string | null;
      customerId: string;
      assinatura: SnapshotAssinatura;
      carencia: AcaoCarencia;
    }
  | { tipo: "pix"; userId: string; customerId: string | null; sessionId: string };

const idDe = (v: string | ComId | null | undefined): string | null =>
  v == null ? null : typeof v === "string" ? v : v.id;

export function snapshotDe(sub: SubscriptionLike): SnapshotAssinatura {
  const itens = sub.items.data;
  const fim = itens.reduce((max, i) => Math.max(max, i.current_period_end), 0);
  return {
    id: sub.id,
    status: sub.status,
    priceId: itens[0]?.price.id ?? null,
    currentPeriodEnd: fim ? new Date(fim * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end || Boolean(sub.cancel_at),
  };
}

const objetoComId = z.object({ id: z.string() });
const faturaSchema = z.object({
  parent: z
    .object({
      subscription_details: z.object({ subscription: z.union([z.string(), objetoComId]) }).nullish(),
    })
    .nullish(),
});

/** Assinatura referenciada por uma fatura (API nova: `parent.subscription_details`). */
export function assinaturaDaFatura(objeto: unknown): string | null {
  const parsed = faturaSchema.safeParse(objeto);
  if (!parsed.success) return null;
  return idDe(parsed.data.parent?.subscription_details?.subscription);
}

async function mudancaDaAssinatura(
  stripe: StripeLike,
  subscriptionId: string,
  userIdHint: string | null,
  carencia: AcaoCarencia,
): Promise<Mudanca> {
  // Sempre o estado atual na API: eventos chegam fora de ordem.
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = idDe(sub.customer);
  if (!customerId) return { tipo: "ignorar", motivo: "assinatura sem cliente" };
  return {
    tipo: "sincronizar",
    userIdHint: userIdHint ?? sub.metadata?.userId ?? null,
    customerId,
    assinatura: snapshotDe(sub),
    carencia,
  };
}

/** Traduz um evento do Stripe na mudança a aplicar, consultando a API para o estado atual. */
export async function mapearEvento(evento: EventoLike, stripe: StripeLike): Promise<Mudanca> {
  if (!EVENTOS_TRATADOS.has(evento.type)) return { tipo: "ignorar", motivo: "evento não tratado" };
  const objeto = objetoComId.safeParse(evento.data.object);
  if (!objeto.success) return { tipo: "ignorar", motivo: "objeto sem id" };
  const objetoId = objeto.data.id;

  switch (evento.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const sessao = await stripe.checkout.sessions.retrieve(objetoId);
      const userId = sessao.client_reference_id ?? sessao.metadata?.userId ?? null;
      if (sessao.mode === "subscription") {
        const subId = idDe(sessao.subscription);
        if (!subId) return { tipo: "ignorar", motivo: "sessão sem assinatura" };
        return mudancaDaAssinatura(stripe, subId, userId, "manter");
      }
      if (sessao.mode === "payment" && sessao.metadata?.tipo === TIPO_PIX_ANUAL) {
        // Pix confirma depois: só concede quando o pagamento está pago.
        if (sessao.payment_status !== "paid") return { tipo: "ignorar", motivo: "pix ainda não pago" };
        if (!userId) return { tipo: "ignorar", motivo: "sessão sem usuário" };
        return { tipo: "pix", userId, customerId: idDe(sessao.customer), sessionId: sessao.id };
      }
      return { tipo: "ignorar", motivo: "sessão de outro tipo" };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return mudancaDaAssinatura(stripe, objetoId, null, "manter");
    case "invoice.paid":
    case "invoice.payment_failed": {
      const subId = assinaturaDaFatura(evento.data.object);
      if (!subId) return { tipo: "ignorar", motivo: "fatura sem assinatura" };
      return mudancaDaAssinatura(stripe, subId, null, evento.type === "invoice.paid" ? "limpar" : "iniciar");
    }
    default:
      return { tipo: "ignorar", motivo: "evento não tratado" };
  }
}

// ─────────────────────────── Aplicação (transacional) ───────────────────────────

/** Aplica a mudança dentro da transação e devolve os e-mails a enviar depois do commit. */
export async function aplicarMudanca(tx: AssinaturaTx, mudanca: Mudanca, agora: Date): Promise<EmailAssinatura[]> {
  if (mudanca.tipo === "ignorar") return [];
  const emails: EmailAssinatura[] = [];
  let userId: string;

  if (mudanca.tipo === "pix") {
    userId = mudanca.userId;
    const atual = await tx.porUsuario(userId);
    const customerId = mudanca.customerId ?? atual?.stripeCustomerId;
    if (!customerId) {
      log("warn", "stripe.pix_sem_cliente", { userId });
      return [];
    }
    // Um pagamento concede acesso uma única vez, mesmo que chegue por dois eventos
    // (completed + async_payment_succeeded). A chave fica na tabela de idempotência.
    if (!(await tx.registrarEvento(`pix:${mudanca.sessionId}`, "pix.concedido"))) return [];
    const accessUntil = calcularAccessUntilPix(atual?.accessUntil ?? null, agora);
    await tx.salvar(userId, customerId, { accessUntil, renewalReminderSentAt: null });
    await tx.auditar("assinatura.pix_pago", userId, {
      sessao: mudanca.sessionId,
      accessUntil: accessUntil.toISOString(),
    });
    emails.push({ tipo: "ativada", userId, via: "pix", acessoAte: accessUntil });
  } else {
    const { assinatura: a } = mudanca;
    const atual =
      (mudanca.userIdHint ? await tx.porUsuario(mudanca.userIdHint) : null) ??
      (await tx.porCustomer(mudanca.customerId));
    const alvo = mudanca.userIdHint ?? atual?.userId;
    if (!alvo) {
      log("warn", "stripe.cliente_desconhecido", { assinatura: a.id });
      return [];
    }
    userId = alvo;
    // Evento atrasado de uma assinatura antiga não pode sobrescrever a atual.
    if (atual?.stripeSubscriptionId && atual.stripeSubscriptionId !== a.id && STATUS_TERMINAIS.has(a.status)) {
      return [];
    }
    const carencia = calcularCarencia(atual?.graceUntil ?? null, a.status, mudanca.carencia, agora);
    await tx.salvar(userId, mudanca.customerId, {
      stripeSubscriptionId: a.id,
      status: a.status,
      priceId: a.priceId,
      currentPeriodEnd: a.currentPeriodEnd,
      cancelAtPeriodEnd: a.cancelAtPeriodEnd,
      graceUntil: carencia.graceUntil,
    });
    if (atual?.status !== a.status) {
      await tx.auditar("assinatura.status", userId, { de: atual?.status ?? null, para: a.status, assinatura: a.id });
    }
    if (carencia.iniciou && carencia.graceUntil) {
      emails.push({ tipo: "pagamento_falhou", userId, graceUntil: carencia.graceUntil });
    }
  }

  const transicao = await aplicarPlanoEfetivoCom(tx, userId, agora);
  if (transicao.de === "FREE" && transicao.para === "PRO" && mudanca.tipo === "sincronizar") {
    emails.push({ tipo: "ativada", userId, via: "cartao", acessoAte: mudanca.assinatura.currentPeriodEnd });
  }
  if (transicao.de === "PRO" && transicao.para === "FREE") emails.push({ tipo: "voltou_gratis", userId });
  return emails;
}

export type ResultadoWebhook = "processado" | "duplicado" | "ignorado";

/**
 * Processa um evento já verificado. Idempotente por `event.id`: o id é gravado
 * na mesma transação do efeito. Erros sobem para a rota responder 500 e o
 * Stripe reenviar.
 */
export async function processarEvento(
  evento: EventoLike,
  deps: { stripe: StripeLike; repo: AssinaturaRepo; enviarEmail: EnviarEmailAssinatura; agora?: () => Date },
): Promise<ResultadoWebhook> {
  if (!EVENTOS_TRATADOS.has(evento.type)) return "ignorado";
  if (await deps.repo.eventoProcessado(evento.id)) return "duplicado";

  const mudanca = await mapearEvento(evento, deps.stripe);
  const agora = deps.agora?.() ?? new Date();

  const emails = await deps.repo.transacao(async (tx) => {
    if (!(await tx.registrarEvento(evento.id, evento.type))) return null;
    return aplicarMudanca(tx, mudanca, agora);
  });
  if (emails === null) return "duplicado";

  for (const email of emails) {
    try {
      await deps.enviarEmail(email);
    } catch (erro) {
      // O efeito já foi gravado; falha de e-mail não deve fazer o Stripe reenviar.
      log("error", "assinatura.email_falhou", {
        tipo: email.tipo,
        erro: erro instanceof Error ? erro.message : String(erro),
      });
    }
  }
  if (mudanca.tipo === "ignorar") log("debug", "stripe.evento_ignorado", { tipo: evento.type, motivo: mudanca.motivo });
  return "processado";
}
