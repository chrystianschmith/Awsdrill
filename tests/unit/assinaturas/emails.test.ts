import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import AssinaturaAtivadaEmail from "@/emails/assinatura/assinatura-ativada";
import LembreteRenovacaoPixEmail from "@/emails/assinatura/lembrete-renovacao-pix";
import PagamentoFalhouEmail from "@/emails/assinatura/pagamento-falhou";
import VoltouGratisEmail from "@/emails/assinatura/voltou-gratis";

const appUrl = "https://app.exemplo.com.br";
const data = new Date("2026-10-11T15:00:00Z");

describe("e-mails de assinatura", () => {
  it("pagamento falhou mostra o fim da carência e leva à assinatura", async () => {
    const html = await render(createElement(PagamentoFalhouEmail, { nome: "Ana", graceUntil: data, appUrl }));
    expect(html).toContain("11 de outubro de 2026");
    expect(html).toContain(`${appUrl}/conta/assinatura`);
  });

  it("assinatura ativada via Pix mostra até quando vale", async () => {
    const html = await render(
      createElement(AssinaturaAtivadaEmail, { nome: "Ana", via: "pix", acessoAte: data, appUrl }),
    );
    expect(html).toContain("Recebemos seu Pix");
  });

  it("voltou ao Grátis garante que nada foi apagado", async () => {
    const html = await render(createElement(VoltouGratisEmail, { nome: "Ana", appUrl }));
    expect(html).toContain("Nenhum dado foi apagado");
  });

  it("lembrete do Pix leva aos preços", async () => {
    const html = await render(createElement(LembreteRenovacaoPixEmail, { nome: "Ana", accessUntil: data, appUrl }));
    expect(html).toContain(`${appUrl}/precos`);
  });
});
