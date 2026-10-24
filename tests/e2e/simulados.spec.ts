import { expect, test, type Page } from "@playwright/test";
import { violacoesA11y } from "./apoio/a11y";
import { criarConta, entrarComo } from "./apoio/contas";
import { banco, fecharBanco } from "./apoio/db";

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

async function seguir(userId: string, codigo: string) {
  const exame = await banco().query(`SELECT id FROM "ExamVersion" WHERE code = $1`, [codigo]);
  await banco().query(`INSERT INTO "UserExam" (id, "userId", "examVersionId") VALUES ($1, $2, $3)`, [
    `ue-${userId}-${codigo}`,
    userId,
    exame.rows[0].id,
  ]);
}

/** Marca a alternativa A (e C, se a questão pede duas): é a certa nas questões fictícias. */
async function marcarCerta(page: Page) {
  const pede2 = await page.getByText("Escolha 2 alternativas.").isVisible();
  await page.getByRole(pede2 ? "checkbox" : "radio", { name: /^A\./ }).check();
  if (pede2) await page.getByRole("checkbox", { name: /^C\./ }).check();
}

test("simulado em modo prova completo → relatório por domínio", async ({ context, page }) => {
  const conta = await criarConta("prova", { pro: true });
  await seguir(conta.id, "CLF-C02");
  await entrarComo(context, conta);

  await page.goto("/simulados");
  await page.getByRole("radio", { name: /Prova/ }).check();
  await clicarAte(
    () => page.getByRole("button", { name: "Começar prova" }).click({ timeout: 2_000 }),
    () => expect(page).toHaveURL(/\/simulados\/[^/]+$/, { timeout: 3_000 }),
  );
  await expect(page.getByRole("timer", { name: "Tempo restante" })).toBeVisible();
  await expect(page.getByText(/questão 1 de 48/)).toBeVisible();

  for (let i = 0; i < 3; i++) {
    await marcarCerta(page);
    await expect(page.getByText(new RegExp(`${i + 1} respondidas?`))).toBeVisible();
    await page.getByRole("button", { name: "Próxima" }).click();
  }
  // Sem correção durante a prova.
  await expect(page.getByText(/Resposta (certa|errada)/)).toHaveCount(0);

  await page.getByRole("button", { name: "Enviar prova" }).click();
  await expect(page.getByText("Você respondeu 3 de 48.", { exact: false })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar" }).click();

  await expect(page).toHaveURL(/\/relatorio$/);
  await expect(page.getByRole("heading", { name: "Relatório · CLF-C02" })).toBeVisible();
  await expect(page.getByText("3 de 48")).toBeVisible();
  for (const nome of ["Conceitos de nuvem", "Segurança e conformidade"])
    await expect(page.getByText(new RegExp(`\\d\\. ${nome}`)).first()).toBeVisible();
  const r = await banco().query(`SELECT status, "correctCount" FROM "MockAttempt" WHERE "userId" = $1`, [conta.id]);
  expect(r.rows[0]).toMatchObject({ status: "SUBMITTED", correctCount: 3 });

  // Prontidão: foto gravada no envio e estimativa com faixa, marcada como amostra pequena.
  await page.getByRole("link", { name: "Ver prontidão" }).click();
  await expect(page).toHaveURL(/\/prontidao#CLF-C02$/);
  await expect(page.getByText("estimativa", { exact: true })).toBeVisible();
  await expect(page.getByText("responda mais 17 para sair da amostra pequena")).toBeVisible();
  await expect(page.getByText("amostra pequena", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: /^Prontidão no CLF-C02: estimativa \d+ de 100, faixa de \d+ a \d+$/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plano de correção" })).toBeVisible();
  await expect(page.getByText("Ao fim dos últimos simulados")).toBeVisible();
  const fotos = await banco().query(`SELECT count(*)::int AS n FROM "ReadinessScore" WHERE "userId" = $1`, [conta.id]);
  expect(fotos.rows[0].n).toBeGreaterThan(1);
});

test("plano de correção leva ao treino do domínio já escolhido", async ({ context, page }) => {
  const conta = await criarConta("plano", { pro: true });
  await seguir(conta.id, "CLF-C02");
  await entrarComo(context, conta);
  await page.goto("/prontidao");
  await expect(page.locator("main h1")).toHaveText("Prontidão");
  expect(await violacoesA11y(page), "/prontidao").toEqual([]);
  const treinar = page.getByRole("link", { name: /^Treinar o domínio / }).first();
  const dominio = (await treinar.getAttribute("aria-label"))!.replace("Treinar o domínio ", "");
  await treinar.click();
  await expect(page).toHaveURL(/\/simulados\?exame=.+&dominio=.+/);
  await expect(page.getByRole("checkbox", { name: new RegExp(`^${dominio}\\. `) })).toBeChecked();
});

test("treino mostra a correção e a fonte oficial logo após responder", async ({ context, page }) => {
  const conta = await criarConta("treino");
  await seguir(conta.id, "CLF-C02");
  await entrarComo(context, conta);

  await page.goto("/simulados");
  await clicarAte(
    () => page.getByRole("button", { name: "Começar treino" }).click({ timeout: 2_000 }),
    () => expect(page).toHaveURL(/\/simulados\/[^/]+$/, { timeout: 3_000 }),
  );
  await expect(page.getByText(/questão 1 de 10/)).toBeVisible();
  await clicarAte(
    async () => {
      await marcarCerta(page);
      await page.getByRole("button", { name: "Responder" }).click({ timeout: 2_000 });
    },
    () => expect(page.getByText("Resposta certa")).toBeVisible({ timeout: 2_000 }),
  );
  await expect(page.getByRole("link", { name: /Documentação oficial/ })).toHaveAttribute(
    "href",
    /^https:\/\/docs\.aws\.amazon\.com\//,
  );
  await page.getByRole("button", { name: "Próxima" }).click();
  await expect(page.getByText(/questão 2 de 10/)).toBeVisible();
  if (await page.getByText("Escolha 2 alternativas.").isVisible()) {
    await page.getByRole("checkbox", { name: /^B\./ }).check();
    await page.getByRole("checkbox", { name: /^D\./ }).check();
  } else {
    await page.getByRole("radio", { name: /^B\./ }).check();
  }
  await page.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByText(/Resposta errada\. Correta: A/)).toBeVisible();
});

test("simulados sem violações de acessibilidade", async ({ context, page }) => {
  const conta = await criarConta("a11y-simulado", { pro: true });
  await seguir(conta.id, "CLF-C02");
  await entrarComo(context, conta);
  await page.goto("/simulados");
  await expect(page.locator("main h1")).toBeVisible();
  expect(await violacoesA11y(page), "/simulados").toEqual([]);

  await clicarAte(
    () => page.getByRole("button", { name: "Começar treino" }).click({ timeout: 2_000 }),
    () => expect(page).toHaveURL(/\/simulados\/[^/]+$/, { timeout: 3_000 }),
  );
  await expect(page.getByText(/questão 1 de 10/)).toBeVisible();
  expect(await violacoesA11y(page), "execução").toEqual([]);

  // Relatório de um treino encerrado (o envio pela tela já é coberto no teste da prova).
  const id = page.url().split("/simulados/")[1]!.split("/")[0]!;
  await banco().query(
    `UPDATE "MockAttempt" SET status = 'SUBMITTED', "submittedAt" = now(), "correctCount" = 0, "domainReport" = '[]' WHERE id = $1`,
    [id],
  );
  await page.goto(`/simulados/${id}/relatorio`);
  await expect(page.locator("main h1")).toBeVisible();
  expect(await violacoesA11y(page), "relatório").toEqual([]);
});
