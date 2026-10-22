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

async function seguir(userId: string, codigo: string) {
  const exame = await banco().query(`SELECT id FROM "ExamVersion" WHERE code = $1`, [codigo]);
  await banco().query(`INSERT INTO "UserExam" (id, "userId", "examVersionId") VALUES ($1, $2, $3)`, [
    `ue-${userId}-${codigo}`,
    userId,
    exame.rows[0].id,
  ]);
}

test("montar ciclo → Hoje sugere o domínio → estudar no modo ciclo", async ({ context, page }) => {
  const conta = await criarConta("ciclo");
  await seguir(conta.id, "CLF-C02");
  await entrarComo(context, conta);

  await page.goto("/ciclo");
  await page.getByLabel("Horas do ciclo").fill("4");
  await clicarAte(
    () => page.getByRole("button", { name: "Ver distribuição" }).click({ timeout: 2_000 }),
    () => expect(page.getByText("Distribuição sugerida")).toBeVisible({ timeout: 2_000 }),
  );
  await page.getByRole("button", { name: "Criar ciclo" }).click();
  await expect(page.getByRole("heading", { name: /CLF-C02 · ciclo 1/ })).toBeVisible();

  // Pesos 24/30/34/12 de 240 min: o domínio 3 (82 min) é o próximo.
  await page.goto("/hoje");
  await expect(page.getByText("CLF-C02 · 3. Tecnologia e serviços de nuvem")).toBeVisible();
  await page.getByRole("link", { name: "Estudar agora" }).click();
  await expect(page).toHaveURL(/modo=CICLO/);
  await expect(page.getByRole("radio", { name: /Ciclo:/ })).toBeChecked();
  await expect(page.locator("#sessao-dominio")).toHaveValue(/.+/);
  await clicarAte(
    () => page.getByRole("button", { name: "Iniciar" }).click({ timeout: 2_000 }),
    () => expect(page.getByRole("timer", { name: "Tempo estudado" })).toBeVisible({ timeout: 2_000 }),
  );
  await expect(page.getByText("CLF-C02 · 3. Tecnologia e serviços de nuvem")).toBeVisible();
  const r = await banco().query(`SELECT mode FROM "StudySession" WHERE "userId" = $1 AND "endedAt" IS NULL`, [conta.id]);
  expect(r.rows[0].mode).toBe("CICLO");
  await page.getByRole("button", { name: "Encerrar" }).click();
  await expect(page.getByText(/Sessão salva/)).toBeVisible();
});

test("revisão vencida aparece no Hoje e avança ao revisar bem", async ({ context, page }) => {
  const conta = await criarConta("revisao");
  await seguir(conta.id, "CLF-C02");
  const tarefa = await banco().query(
    `SELECT d.id FROM "Domain" d JOIN "ExamVersion" v ON v.id = d."examVersionId"
     WHERE v.code = 'CLF-C02' AND d.code = '1.1'`,
  );
  await banco().query(
    `INSERT INTO "Review" (id, "userId", "topicId", step, "dueAt") VALUES ($1, $2, $3, 0, now() - interval '2 days')`,
    [`rv-${conta.id}`, conta.id, tarefa.rows[0].id],
  );
  await entrarComo(context, conta);

  await page.goto("/hoje");
  const secao = page.getByRole("region", { name: /Revisões para hoje/ });
  await expect(secao.getByText(/^1\.1 /)).toBeVisible();
  await expect(secao.getByText(/2 dias de atraso/)).toBeVisible();
  await clicarAte(
    () => secao.getByRole("button", { name: "Revisei bem" }).click({ timeout: 2_000 }),
    () => expect(page.getByText("Revisão registrada.", { exact: false })).toBeVisible({ timeout: 2_000 }),
  );
  await expect
    .poll(async () => {
      const r = await banco().query(`SELECT step FROM "Review" WHERE "userId" = $1 AND "doneAt" IS NULL`, [conta.id]);
      return r.rows.map((x) => x.step);
    })
    .toEqual([1]);
  await page.goto("/revisoes");
  await expect(page.getByText("Tudo revisado")).toBeVisible();
  await expect(page.getByRole("region", { name: "Próximos 7 dias" }).getByText(/^1\.1 /)).toBeVisible();
});

test("ciclo e revisões sem violações de acessibilidade", async ({ context, page }) => {
  const conta = await criarConta("a11y-ciclo");
  await seguir(conta.id, "SAA-C03");
  await entrarComo(context, conta);
  for (const rota of ["/ciclo", "/revisoes"]) {
    await page.goto(rota);
    await expect(page.locator("main h1")).toBeVisible();
    expect(await violacoesA11y(page), rota).toEqual([]);
  }
});
