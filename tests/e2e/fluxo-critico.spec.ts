import { expect, test } from "@playwright/test";
import { violacoesA11y } from "./apoio/a11y";
import { emailUnico } from "./apoio/contas";
import { URL_STRIPE_MOCK } from "./apoio/constantes";
import { fecharBanco } from "./apoio/db";
import { aguardarEmail, linkDoEmail } from "./apoio/emails";

test.afterAll(async () => {
  await fecharBanco();
});

/** Clica e espera o efeito; repete se o clique acontecer antes da hidratação. */
async function clicarAte(clicar: () => Promise<unknown>, efeito: () => Promise<void>) {
  await expect(async () => {
    await clicar();
    await efeito();
  }).toPass({ timeout: 15_000 });
}

/*
 * Fluxo crítico só pela interface, como um visitante novo: início → cadastro → confirmar e-mail →
 * escolher exame → estudar → treino → prontidão → assinar Pro → prova → carteira.
 */
test("visitante vira assinante e usa o produto de ponta a ponta", async ({ page }) => {
  test.setTimeout(150_000);
  const email = emailUnico("fluxo");

  await page.goto("/");
  expect(await violacoesA11y(page), "/").toEqual([]);
  await page.getByRole("main").getByRole("link", { name: "Começar grátis" }).click();
  await expect(page).toHaveURL(/\/cadastro$/);

  await page.getByLabel("Nome").fill("Bruna Fluxo");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("Trilha-Verde-2026");
  await page.getByLabel(/Li e aceito os/).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByText(`Confirme seu e-mail ${email}`)).toBeVisible();

  await page.goto(linkDoEmail(await aguardarEmail(email, "Confirme seu e-mail"), "/confirmar-email"));
  await expect(page.getByRole("heading", { level: 1, name: "E-mail confirmado" })).toBeVisible();

  // Escolher o exame a partir do estado vazio do Hoje.
  await page.goto("/hoje");
  await expect(page.getByText(`Confirme seu e-mail ${email}`)).toHaveCount(0);
  await page.getByRole("link", { name: "Escolher exame" }).click();
  await clicarAte(
    () => page.getByRole("button", { name: "Seguir CLF-C02" }).click({ timeout: 2_000 }),
    () => expect(page.getByRole("heading", { name: "CLF-C02" })).toBeVisible({ timeout: 2_000 }),
  );

  // Estudar com o timer.
  await page.goto("/estudar");
  await clicarAte(
    () => page.getByRole("button", { name: "Iniciar" }).click({ timeout: 2_000 }),
    () => expect(page.getByRole("timer", { name: "Tempo estudado" })).toBeVisible({ timeout: 2_000 }),
  );
  await page.getByRole("button", { name: "Encerrar" }).click();
  await expect(page.getByText(/Sessão salva/)).toBeVisible();

  // Treino com correção imediata; a prova é do Pro.
  await page.goto("/simulados");
  await expect(page.getByRole("radio", { name: /Prova/ })).toBeDisabled();
  await clicarAte(
    () => page.getByRole("button", { name: "Começar treino" }).click({ timeout: 2_000 }),
    () => expect(page).toHaveURL(/\/simulados\/[^/]+$/, { timeout: 3_000 }),
  );
  await clicarAte(
    async () => {
      const pede2 = await page.getByText("Escolha 2 alternativas.").isVisible();
      await page.getByRole(pede2 ? "checkbox" : "radio", { name: /^A\./ }).check();
      if (pede2) await page.getByRole("checkbox", { name: /^C\./ }).check();
      await page.getByRole("button", { name: "Responder" }).click({ timeout: 2_000 });
    },
    () => expect(page.getByText("Resposta certa")).toBeVisible({ timeout: 2_000 }),
  );

  await page.goto("/prontidao");
  await expect(page.locator("main h1")).toHaveText("Prontidão");

  // Assinar pelo bloqueio da prova: Checkout (mock) → webhook → Pro.
  await page.goto("/simulados");
  await page.getByRole("link", { name: "Ver plano Pro" }).first().click();
  await expect(page).toHaveURL(/\/precos/);
  const indoAoCheckout = page.waitForRequest((r) => r.url().startsWith(`${URL_STRIPE_MOCK}/checkout/`));
  await page.getByRole("button", { name: "Assinar mensal" }).click();
  await indoAoCheckout;
  await expect(page.getByText("Pagamento confirmado")).toBeVisible({ timeout: 15_000 });
  await aguardarEmail(email, "Seu plano Pro está ativo");

  await page.goto("/simulados");
  await page.getByRole("radio", { name: /Prova/ }).check();
  await clicarAte(
    () => page.getByRole("button", { name: "Começar prova" }).click({ timeout: 2_000 }),
    () => expect(page).toHaveURL(/\/simulados\/[^/]+$/, { timeout: 3_000 }),
  );
  await expect(page.getByRole("timer", { name: "Tempo restante" })).toBeVisible();

  // Depois do exame real: registrar na carteira.
  await page.goto("/carteira");
  await clicarAte(
    () => page.getByRole("button", { name: "Adicionar certificação" }).click({ timeout: 2_000 }),
    () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 }),
  );
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Certificação").selectOption({ label: "AWS Certified Cloud Practitioner" });
  await dialogo.getByLabel("Data do exame").fill("2026-01-15");
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(/Válida até 15 de jan\.? de 2029/)).toBeVisible();
});
