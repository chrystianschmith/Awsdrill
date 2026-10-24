import "server-only";
import { createElement } from "react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import AssinaturaAtivadaEmail, { assuntoAssinaturaAtivada } from "@/emails/assinatura/assinatura-ativada";
import LembreteRenovacaoPixEmail, { assuntoLembretePix } from "@/emails/assinatura/lembrete-renovacao-pix";
import PagamentoFalhouEmail, { assuntoPagamentoFalhou } from "@/emails/assinatura/pagamento-falhou";
import VoltouGratisEmail, { assuntoVoltouGratis } from "@/emails/assinatura/voltou-gratis";
import type { EmailAssinatura } from "./tipos";

/** Envia um e-mail de assinatura ao usuário (ignora contas excluídas). */
export async function enviarEmailAssinatura(email: EmailAssinatura): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: email.userId },
    select: { email: true, name: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return;
  const appUrl = env().APP_URL;
  const nome = user.name.split(" ")[0] || user.name;

  switch (email.tipo) {
    case "pagamento_falhou":
      return sendEmail({
        to: user.email,
        subject: assuntoPagamentoFalhou,
        react: createElement(PagamentoFalhouEmail, { nome, graceUntil: email.graceUntil, appUrl }),
      });
    case "ativada":
      return sendEmail({
        to: user.email,
        subject: assuntoAssinaturaAtivada,
        react: createElement(AssinaturaAtivadaEmail, { nome, via: email.via, acessoAte: email.acessoAte, appUrl }),
      });
    case "voltou_gratis":
      return sendEmail({
        to: user.email,
        subject: assuntoVoltouGratis,
        react: createElement(VoltouGratisEmail, { nome, appUrl }),
      });
    case "lembrete_pix":
      return sendEmail({
        to: user.email,
        subject: assuntoLembretePix,
        react: createElement(LembreteRenovacaoPixEmail, { nome, accessUntil: email.accessUntil, appUrl }),
      });
  }
}
