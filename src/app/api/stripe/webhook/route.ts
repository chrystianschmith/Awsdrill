import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { enviarEmailAssinatura } from "@/lib/assinaturas/emails";
import { repoPrisma } from "@/lib/assinaturas/repo-prisma";
import { getStripe } from "@/lib/assinaturas/stripe";
import { processarEvento } from "@/lib/assinaturas/webhook";

/**
 * Webhook do Stripe. Lê o corpo cru, valida a assinatura e processa o evento
 * de forma idempotente. Qualquer erro responde 500 para o Stripe reenviar.
 */
export async function POST(request: NextRequest) {
  const segredo = env().STRIPE_WEBHOOK_SECRET;
  if (!segredo || !env().STRIPE_SECRET_KEY) {
    log("error", "stripe.webhook_desconfigurado");
    return NextResponse.json({ erro: "Webhook não configurado." }, { status: 500 });
  }
  const assinatura = request.headers.get("stripe-signature");
  if (!assinatura) return NextResponse.json({ erro: "Assinatura ausente." }, { status: 400 });

  const stripe = getStripe();
  const corpo = await request.text();
  let evento;
  try {
    evento = stripe.webhooks.constructEvent(corpo, assinatura, segredo);
  } catch {
    log("warn", "stripe.webhook_assinatura_invalida");
    return NextResponse.json({ erro: "Assinatura inválida." }, { status: 400 });
  }

  try {
    const resultado = await processarEvento(evento, { stripe, repo: repoPrisma, enviarEmail: enviarEmailAssinatura });
    log("info", "stripe.webhook", { evento: evento.id, tipo: evento.type, resultado });
    return NextResponse.json({ recebido: true, resultado });
  } catch (erro) {
    log("error", "stripe.webhook_falhou", {
      evento: evento.id,
      tipo: evento.type,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
    return NextResponse.json({ erro: "Falha ao processar o evento." }, { status: 500 });
  }
}
