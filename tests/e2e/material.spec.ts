import { expect, test } from "@playwright/test";
import { violacoesA11y } from "./apoio/a11y";
import { criarConta, entrarComo } from "./apoio/contas";
import { banco, fecharBanco, novoId } from "./apoio/db";

test.afterAll(async () => {
  await fecharBanco();
});

async function tarefa(codigoExame: string, codigo: string) {
  const r = await banco().query(
    `SELECT d.id, v.id AS "examVersionId" FROM "Domain" d JOIN "ExamVersion" v ON v.id = d."examVersionId"
     WHERE v.code = $1 AND d.code = $2`,
    [codigoExame, codigo],
  );
  return r.rows[0] as { id: string; examVersionId: string };
}

/** Material já gerado (como se a IA tivesse rodado), recriado a cada execução. */
async function semearMaterial(topicId: string) {
  const db = banco();
  await db.query(`DELETE FROM "ContentReport" WHERE "topicId" = $1`, [topicId]);
  await db.query(`DELETE FROM "Flashcard" WHERE "topicId" = $1`, [topicId]);
  await db.query(`DELETE FROM "Summary" WHERE "topicId" = $1`, [topicId]);
  await db.query(
    `INSERT INTO "Summary" (id, "topicId", body, sources, model, "promptVersion") VALUES ($1, $2, $3, $4, 'mock', 'e2e')`,
    [
      novoId(),
      topicId,
      "### Vantagens da nuvem\nResumo de teste com **negrito**.\n\n- Item um\n- Item <script>alert(1)</script>",
      ["https://docs.aws.amazon.com/whitepapers/latest/aws-overview/introduction.html"],
    ],
  );
  for (let i = 1; i <= 5; i++) {
    await db.query(
      `INSERT INTO "Flashcard" (id, "topicId", front, back, "promptVersion") VALUES ($1, $2, $3, $4, 'e2e')`,
      [novoId(), topicId, `Pergunta de teste ${i}`, `Resposta de teste ${i}`],
    );
  }
}

test("material da tarefa: selo de IA, texto sanitizado, flashcard e reportar erro", async ({ context, page }) => {
  const t = await tarefa("CLF-C02", "1.1");
  await semearMaterial(t.id);
  const conta = await criarConta("material", { pro: true });
  await banco().query(`INSERT INTO "UserExam" (id, "userId", "examVersionId") VALUES ($1, $2, $3)`, [
    novoId(),
    conta.id,
    t.examVersionId,
  ]);
  await entrarComo(context, conta);

  await page.goto(`/material/${t.id}`);
  await expect(page.getByRole("heading", { name: "Vantagens da nuvem" })).toBeVisible();
  await expect(page.getByText("Gerado por IA").first()).toBeVisible();
  await expect(page.getByText("<script>alert(1)</script>", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /docs\.aws\.amazon\.com/ })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  expect(await violacoesA11y(page)).toEqual([]);

  await page.getByText("Pergunta de teste 1").click();
  await expect(page.getByText("Resposta de teste 1")).toBeVisible();

  await expect(async () => {
    await page.getByRole("button", { name: "Reportar erro: resumo" }).click({ timeout: 2_000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await page.getByLabel("O que está errado?").fill("A fonte não fala disso.");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("O erro foi enviado para revisão.")).toBeVisible();
  const r = await banco().query(`SELECT count(*)::int AS n FROM "ContentReport" WHERE "topicId" = $1`, [t.id]);
  expect(r.rows[0].n).toBe(1);

  // Tarefa sem material e sem chave de IA no ambiente de teste.
  const outra = await tarefa("CLF-C02", "1.2");
  await page.goto(`/material/${outra.id}`);
  await expect(page.getByText("Material ainda não disponível")).toBeVisible();
});

test("material de exame que o usuário não segue não abre", async ({ context, page }) => {
  const t = await tarefa("CLF-C02", "1.1");
  const conta = await criarConta("material-estranho", { pro: true });
  await entrarComo(context, conta);
  await page.goto(`/material/${t.id}`);
  await expect(page.getByRole("heading", { name: /não encontrada|não existe/i })).toBeVisible();
});
