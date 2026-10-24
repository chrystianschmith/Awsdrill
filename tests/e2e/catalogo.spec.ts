import { expect, test } from "@playwright/test";
import { violacoesA11y } from "./apoio/a11y";

// O catálogo vem do seed (npm run db:seed), aplicado no banco de e2e antes dos testes.

test("lista as certificações por nível e abre o detalhe com domínios, pesos e fontes", async ({ page }) => {
  await page.goto("/certificacoes");
  await expect(page.getByRole("heading", { level: 1, name: "Certificações" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Foundational" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Associate" })).toBeVisible();
  for (const codigo of ["CLF-C02", "AIF-C01", "SAA-C03"])
    await expect(page.getByText(codigo, { exact: true })).toBeVisible();
  expect(await violacoesA11y(page)).toEqual([]);

  await page.getByRole("link", { name: "AWS Certified Solutions Architect – Associate" }).click();
  await expect(page).toHaveURL(/\/certificacoes\/solutions-architect-associate$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "AWS Certified Solutions Architect – Associate" }),
  ).toBeVisible();
  await expect(page.getByText("720 de 1000")).toBeVisible();
  await expect(page.getByText("130 min")).toBeVisible();

  const dominios = page.getByRole("heading", { level: 3 });
  await expect(dominios).toHaveCount(4);
  await expect(dominios.first()).toContainText("Design Secure Architectures");
  const pesos = await page.locator("ol > li span.font-semibold").allTextContents();
  expect(pesos).toEqual(["30%", "26%", "24%", "20%"]);

  await expect(page.getByRole("link", { name: "Exam guide oficial" })).toHaveAttribute(
    "href",
    /^https:\/\/docs\.aws\.amazon\.com\/aws-certification\//,
  );
  expect(await violacoesA11y(page)).toEqual([]);
  const largura = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(largura).toBeLessThanOrEqual(0);
});

test("certificação inexistente responde 404", async ({ page }) => {
  const r = await page.goto("/certificacoes/nao-existe");
  expect(r?.status()).toBe(404);
});

test("início lista os exames do catálogo com link para o detalhe", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "AWS Certified AI Practitioner" }).click();
  await expect(page).toHaveURL(/\/certificacoes\/ai-practitioner$/);
  await expect(page.getByText("Fundamentals of GenAI")).toBeVisible();
});
