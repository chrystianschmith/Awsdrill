import { expect, test, type Page } from "@playwright/test";
import { criarConta, entrarComo } from "./apoio/contas";
import { URL_STRIPE_MOCK } from "./apoio/constantes";
import { banco, fecharBanco, novoId } from "./apoio/db";
import { aguardarEmail } from "./apoio/emails";

test.afterAll(async () => {
  await fecharBanco();
});

const cta = (page: Page, recurso: string) => page.getByText(`${recurso} faz parte do plano Pro`);

/** Clica e espera o efeito; repete se o clique acontecer antes da hidratação. */
async function clicarAte(clicar: () => Promise<unknown>, efeito: () => Promise<void>) {
  await expect(async () => {
    await clicar();
    await efeito();
  }).toPass({ timeout: 15_000 });
}

async function recursosBloqueados(page: Page) {
  await page.goto("/ciclo");
  await expect(cta(page, "Ciclo de estudos automático")).toBeVisible();
  await page.goto("/revisoes");
  await expect(cta(page, "Revisão espaçada (1, 7 e 30 dias)")).toBeVisible();
  await page.goto("/simulados");
  await expect(cta(page, "Simulado em modo prova (tempo e tamanho oficiais)")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Prova/ })).toBeDisabled();
  await page.goto("/prontidao");
  await expect(cta(page, "Prontidão por domínio e plano de correção")).toBeVisible();
}

async function statusSeguidos(userId: string) {
  const r = await banco().query<{ code: string; status: string }>(
    `SELECT v.code, ue.status FROM "UserExam" ue JOIN "ExamVersion" v ON v.id = ue."examVersionId"
     WHERE ue."userId" = $1 ORDER BY v.code`,
    [userId],
  );
  return Object.fromEntries(r.rows.map((l) => [l.code, l.status]));
}

test("limite do Grátis → assinar → Pro liberado → cancelar → Grátis sem perder dados", async ({ page, context }) => {
  test.setTimeout(120_000);
  const conta = await criarConta("assina", { nome: "Carla Assinante" });
  await entrarComo(context, conta);

  // No limite do Grátis: segue o CLF-C02, com uma tarefa em andamento.
  const db = banco();
  const clf = await db.query<{ id: string; tarefa: string }>(
    `SELECT v.id, (SELECT d.id FROM "Domain" d WHERE d."examVersionId" = v.id AND d."parentId" IS NOT NULL
       ORDER BY d.code LIMIT 1) AS tarefa
     FROM "ExamVersion" v WHERE v.code = 'CLF-C02'`,
  );
  await db.query(`INSERT INTO "UserExam" (id, "userId", "examVersionId", "createdAt") VALUES ($1,$2,$3,$4)`, [
    novoId(),
    conta.id,
    clf.rows[0]?.id,
    new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  ]);
  await db.query(
    `INSERT INTO "UserTopic" (id, "userId", "topicId", status, "updatedAt") VALUES ($1,$2,$3,'ESTUDANDO',now())`,
    [novoId(), conta.id, clf.rows[0]?.tarefa],
  );

  // Segundo exame bloqueado.
  await page.goto("/exames");
  await expect(cta(page, "Exames seguidos")).toBeVisible();
  await expect(page.getByRole("button", { name: "Seguir AIF-C01" })).toHaveCount(0);
  await recursosBloqueados(page);

  // Assinar pelo CTA: Checkout hospedado (mock) → webhook assinado → página de sucesso.
  await page.goto("/exames");
  await cta(page, "Exames seguidos").locator("..").getByRole("link", { name: "Ver plano Pro" }).click();
  await expect(page).toHaveURL(/\/precos\?recurso=maxExamesSeguidos/);
  const indoAoCheckout = page.waitForRequest((r) => r.url().startsWith(`${URL_STRIPE_MOCK}/checkout/`));
  await page.getByRole("button", { name: "Assinar mensal" }).click();
  await indoAoCheckout;
  await expect(page).toHaveURL(/\/checkout\/sucesso\?session_id=cs_test_/);
  await expect(page.getByText("Pagamento confirmado")).toBeVisible({ timeout: 15_000 });
  await aguardarEmail(conta.email, "Seu plano Pro está ativo");

  const sub = await db.query<{ status: string; effectivePlan: string; priceId: string }>(
    `SELECT status, "effectivePlan", "priceId" FROM "Subscription" WHERE "userId" = $1`,
    [conta.id],
  );
  expect(sub.rows[0]).toMatchObject({ status: "trialing", effectivePlan: "PRO", priceId: "price_e2e_mensal" });

  await page.goto("/conta/assinatura");
  await expect(page.getByText("Todos os recursos liberados.")).toBeVisible();
  await expect(page.getByText("Teste grátis até")).toBeVisible();

  // Recursos Pro liberados.
  await page.goto("/exames");
  await expect(cta(page, "Exames seguidos")).toHaveCount(0);
  await clicarAte(
    () => page.getByRole("button", { name: "Seguir AIF-C01" }).click({ timeout: 2_000 }),
    () => expect(page.getByText("Agora você estuda o AIF-C01.")).toBeVisible({ timeout: 3_000 }),
  );
  expect(await statusSeguidos(conta.id)).toEqual({ "AIF-C01": "ATIVO", "CLF-C02": "ATIVO" });
  await page.goto("/ciclo");
  await expect(cta(page, "Ciclo de estudos automático")).toHaveCount(0);
  await page.goto("/revisoes");
  await expect(page.getByRole("heading", { name: /Para hoje/ })).toBeVisible();
  await page.goto("/simulados");
  await expect(page.getByRole("radio", { name: /Prova/ })).toBeEnabled();
  await page.goto("/prontidao");
  await expect(page.getByRole("heading", { name: "Por domínio" }).first()).toBeVisible();

  // Cancelar no fim do período: continua Pro até lá.
  await page.goto("/conta/assinatura");
  await page.getByRole("button", { name: "Gerenciar assinatura" }).click();
  await expect(page.getByRole("heading", { name: "Portal do cliente (teste)" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar no fim do período" }).click();
  await expect(page).toHaveURL(/\/conta\/assinatura$/);
  await expect(page.getByText("A renovação está cancelada.", { exact: false })).toBeVisible();

  // Cancelar de vez: volta ao Grátis.
  await page.getByRole("button", { name: "Gerenciar assinatura" }).click();
  await page.getByRole("button", { name: "Cancelar assinatura" }).click();
  await expect(page).toHaveURL(/\/conta\/assinatura$/);
  await expect(page.getByText("Um exame por vez, treinos com limite semanal e prontidão geral.")).toBeVisible();
  await aguardarEmail(conta.email, "Sua conta voltou ao plano Grátis");

  // Nada foi apagado: o exame mais novo fica pausado e o progresso continua.
  expect(await statusSeguidos(conta.id)).toEqual({ "AIF-C01": "PAUSADO", "CLF-C02": "ATIVO" });
  const progresso = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "UserTopic" WHERE "userId" = $1`, [
    conta.id,
  ]);
  expect(progresso.rows[0]?.n).toBe(1);
  await page.goto("/exames");
  await expect(page.getByText("Pausado", { exact: true })).toBeVisible();
  await expect(cta(page, "Exames seguidos")).toBeVisible();
  await recursosBloqueados(page);
});
