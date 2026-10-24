import { expect, test } from "@playwright/test";
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

test("escolher exame → estudar com timer → marcar tarefa → ver progresso e Hoje", async ({ context, page }) => {
  const conta = await criarConta("estudo");
  await entrarComo(context, conta);

  await page.goto("/hoje");
  await expect(page.getByText("Escolha o exame que você vai estudar")).toBeVisible();
  await page.getByRole("link", { name: "Escolher exame" }).click();

  await expect(page).toHaveURL(/\/exames$/);
  const seguir = page.getByRole("button", { name: "Seguir CLF-C02" });
  await clicarAte(
    () => seguir.click({ timeout: 2_000 }),
    () => expect(page.getByRole("heading", { name: "CLF-C02" })).toBeVisible({ timeout: 2_000 }),
  );

  await page.goto("/estudar");
  await expect(page.locator("#sessao-exame")).toHaveValue(/.+/);
  await clicarAte(
    () => page.getByRole("button", { name: "Iniciar" }).click({ timeout: 2_000 }),
    () => expect(page.getByRole("timer", { name: "Tempo estudado" })).toBeVisible({ timeout: 2_000 }),
  );
  await expect(page.getByText("CLF-C02 · 1. Conceitos de nuvem")).toBeVisible();

  // O tempo vem do servidor: recarregar mantém a sessão.
  await page.reload();
  await expect(page.getByRole("timer", { name: "Tempo estudado" })).toBeVisible();
  await clicarAte(
    () => page.getByRole("button", { name: "Pausar" }).click({ timeout: 2_000 }),
    () => expect(page.getByRole("button", { name: "Retomar" })).toBeVisible({ timeout: 2_000 }),
  );
  await page.getByRole("button", { name: "Retomar" }).click();
  await page.getByRole("button", { name: "Encerrar" }).click();
  await expect(page.getByText(/Sessão salva/)).toBeVisible();

  const sessoes = await banco().query(
    `SELECT "durationSec" FROM "StudySession" WHERE "userId" = $1 AND "endedAt" IS NOT NULL`,
    [conta.id],
  );
  expect(sessoes.rowCount).toBe(1);

  await page.goto("/progresso");
  const status = page.getByRole("combobox", { name: /^Status de 1\.1 / });
  await clicarAte(
    () => status.selectOption("CONCLUIDO", { timeout: 2_000 }),
    async () => {
      const r = await banco().query(`SELECT status FROM "UserTopic" WHERE "userId" = $1 AND status = 'CONCLUIDO'`, [
        conta.id,
      ]);
      expect(r.rowCount).toBe(1);
    },
  );
  // Domínio 1 pesa 24% e tem 4 tarefas: 1 concluída = 6% do exame.
  await page.reload();
  await expect(page.getByRole("heading", { name: /CLF-C02 · 6%/ })).toBeVisible();

  await page.goto("/hoje");
  await expect(page.getByText("6%", { exact: true })).toBeVisible();
  await expect(page.getByText("Estudado hoje")).toBeVisible();
});

test("lançamento manual sobreposto é recusado com mensagem", async ({ context, page }) => {
  const conta = await criarConta("manual");
  const exame = await banco().query(`SELECT id FROM "ExamVersion" WHERE code = 'SAA-C03'`);
  await banco().query(`INSERT INTO "UserExam" (id, "userId", "examVersionId") VALUES ($1, $2, $3)`, [
    `ue-${conta.id}`,
    conta.id,
    exame.rows[0].id,
  ]);
  await entrarComo(context, conta);
  await page.goto("/estudar");

  const preencher = async (inicio: string, fim: string) => {
    await page.locator("#manual-dia").fill("2026-10-20");
    await page.locator("#manual-inicio").fill(inicio);
    await page.locator("#manual-fim").fill(fim);
    await page.getByRole("button", { name: "Lançar estudo" }).click();
  };
  await clicarAte(
    () => preencher("08:00", "09:00"),
    () => expect(page.getByText("Estudo lançado.")).toBeVisible({ timeout: 2_000 }),
  );
  await preencher("08:30", "09:30");
  await expect(
    page.getByRole("alert").filter({ hasText: "Já existe uma sessão de estudo nesse horário." }),
  ).toBeVisible();
});

test("telas de estudo sem violações de acessibilidade", async ({ context, page }) => {
  const conta = await criarConta("a11y-estudo");
  const exame = await banco().query(`SELECT id FROM "ExamVersion" WHERE code = 'AIF-C01'`);
  await banco().query(`INSERT INTO "UserExam" (id, "userId", "examVersionId") VALUES ($1, $2, $3)`, [
    `ue-${conta.id}`,
    conta.id,
    exame.rows[0].id,
  ]);
  await entrarComo(context, conta);
  for (const rota of ["/hoje", "/estudar", "/progresso", "/exames"]) {
    await page.goto(rota);
    await expect(page.locator("main h1")).toBeVisible();
    expect(await violacoesA11y(page), rota).toEqual([]);
  }
});
