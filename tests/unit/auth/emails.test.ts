import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import { EmailConfirmacao } from "@/emails/auth/confirmacao";
import { EmailRedefinirSenha } from "@/emails/auth/redefinir-senha";
import { EmailSenhaAlterada } from "@/emails/auth/senha-alterada";

const appUrl = "https://app.exemplo.test";

describe("e-mails de autenticação", () => {
  it("confirmação traz o link e a validade de 24 horas", async () => {
    const html = await render(
      createElement(EmailConfirmacao, { nome: "Ana", link: `${appUrl}/confirmar-email?token=abc`, appUrl }),
    );
    expect(html).toContain(`${appUrl}/confirmar-email?token=abc`);
    expect(html).toContain("24 horas");
    expect(html).toContain(`${appUrl}/conta#notificacoes`);
  });

  it("redefinição traz o link e a validade de 30 minutos", async () => {
    const html = await render(
      createElement(EmailRedefinirSenha, { nome: "Ana", link: `${appUrl}/redefinir-senha?token=xyz`, appUrl }),
    );
    expect(html).toContain(`${appUrl}/redefinir-senha?token=xyz`);
    expect(html).toContain("30 minutos");
  });

  it("senha alterada avisa e oferece redefinir", async () => {
    const html = await render(
      createElement(EmailSenhaAlterada, { nome: "Ana", appUrl, quando: "8 de outubro de 2026" }),
    );
    expect(html).toContain("8 de outubro de 2026");
    expect(html).toContain(`${appUrl}/esqueci-senha`);
  });
});
