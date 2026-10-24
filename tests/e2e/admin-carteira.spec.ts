import { expect, test } from "@playwright/test";
import { violacoesA11y } from "./apoio/a11y";
import { criarConta, entrarComo } from "./apoio/contas";
import { banco, fecharBanco, novoId } from "./apoio/db";

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

test("usuário comum não vê a área de administração", async ({ context, page }) => {
  const conta = await criarConta("nao-admin");
  await entrarComo(context, conta);
  const r = await page.goto("/admin/questoes");
  expect(r?.status()).toBe(404);
});

test("admin aprova uma questão pendente e ela sai da fila", async ({ context, page }, info) => {
  const conta = await criarConta("admin", { admin: true });
  await entrarComo(context, conta);
  const db = banco();
  const dominio = await db.query<{ id: string; examVersionId: string }>(
    `SELECT d.id, d."examVersionId" FROM "Domain" d JOIN "ExamVersion" v ON v.id = d."examVersionId"
     WHERE v.code = 'CLF-C02' AND d.code = '1'`,
  );
  const id = novoId();
  const marca = `Questão pendente do e2e ${info.project.name} ${id}`;
  await db.query(
    `INSERT INTO "Question" (id, "examVersionId", "domainId", type, stem, options, "correctKeys", explanation, "docUrls", origin, "contentHash")
     VALUES ($1,$2,$3,'SINGLE',$4,$5,$6,'Explicação de teste.',$7,'autoral',$8)`,
    [
      id,
      dominio.rows[0]?.examVersionId,
      dominio.rows[0]?.id,
      marca,
      JSON.stringify([
        { key: "A", text: "Alternativa A" },
        { key: "B", text: "Alternativa B" },
        { key: "C", text: "Alternativa C" },
        { key: "D", text: "Alternativa D" },
      ]),
      ["A"],
      ["https://docs.aws.amazon.com/"],
      `e2e-${id}`,
    ],
  );

  await page.goto("/admin/questoes?exame=CLF-C02");
  await expect(page.getByRole("heading", { name: "Questões pendentes" })).toBeVisible();
  const cartao = page.getByRole("listitem").filter({ hasText: marca });
  await expect(cartao).toBeVisible();
  await clicarAte(
    () => cartao.getByRole("button", { name: /^Aprovar questão/ }).click({ timeout: 2_000 }),
    () => expect(page.getByText(marca)).toHaveCount(0, { timeout: 3_000 }),
  );
  const q = await db.query<{ publishState: string }>(`SELECT "publishState" FROM "Question" WHERE id = $1`, [id]);
  expect(q.rows[0]?.publishState).toBe("PUBLISHED");
  await db.query(`DELETE FROM "Question" WHERE id = $1`, [id]);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  expect(await violacoesA11y(page)).toEqual([]);
});

test("carteira: adicionar certificação aprovada mostra a validade de 3 anos", async ({ context, page }) => {
  const conta = await criarConta("carteira");
  await entrarComo(context, conta);
  await page.goto("/carteira");
  await expect(page.getByText("Nenhuma certificação na carteira")).toBeVisible();
  await clicarAte(
    () => page.getByRole("button", { name: "Adicionar certificação" }).click({ timeout: 2_000 }),
    () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 }),
  );
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Certificação").selectOption({ label: "AWS Certified Cloud Practitioner" });
  await dialogo.getByLabel("Data do exame").fill("2025-03-10");
  await dialogo.getByLabel("Código do exame (opcional)").selectOption("CLF-C02");
  await dialogo.getByLabel("Nota (100 a 1000, opcional)").fill("812");
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Certificação adicionada à carteira.")).toBeVisible();
  await expect(page.getByText(/Válida até 10 de mar\.? de 2028/)).toBeVisible();
  await expect(page.getByText("CLF-C02 · feito em", { exact: false })).toBeVisible();
  expect(await violacoesA11y(page)).toEqual([]);
});
