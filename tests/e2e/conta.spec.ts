import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { violacoesA11y } from "./apoio/a11y";
import { criarConta, entrarComo } from "./apoio/contas";
import { banco, fecharBanco } from "./apoio/db";

test.afterAll(async () => {
  await fecharBanco();
});

test("exportar meus dados baixa um JSON só com os dados da conta, sem hashes", async ({ context, page }) => {
  const conta = await criarConta("exp");
  const outra = await criarConta("exp-outra");
  await entrarComo(context, conta);

  await page.goto("/conta");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Baixar meus dados" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
  const texto = await readFile((await download.path()) ?? "", "utf8");
  const dados = JSON.parse(texto) as { formato: string; usuario: { email: string; consents: unknown[] } };
  expect(dados.formato).toBe("trilha-export-v1");
  expect(dados.usuario.email).toBe(conta.email);
  expect(dados.usuario.consents).toHaveLength(2);
  expect(texto).not.toMatch(/passwordHash|tokenHash|argon2/);
  expect(texto).not.toContain(outra.email);

  const log = await banco().query(`SELECT 1 FROM "AuditLog" WHERE "userId" = $1 AND action = 'conta.exportada'`, [conta.id]);
  expect(log.rowCount).toBe(1);
});

test("altera nome e preferências de e-mail", async ({ context, page }) => {
  const conta = await criarConta("pref", { nome: "Nome Antigo" });
  await entrarComo(context, conta);

  await page.goto("/conta");
  const nome = page.getByRole("textbox", { name: "Nome" });
  // Repete se o preenchimento acontecer antes da hidratação do formulário.
  await expect(async () => {
    await nome.fill("Nome Novo");
    await expect(nome).toHaveValue("Nome Novo", { timeout: 500 });
  }).toPass();
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.getByText("Dados atualizados.")).toBeVisible();

  await page.getByLabel(/Recertificação/).uncheck();
  await page.getByRole("button", { name: "Salvar preferências" }).click();
  await expect(page.getByText("Preferências salvas.")).toBeVisible();

  const r = await banco().query<{ name: string; recertificacao: boolean; revisoes: boolean }>(
    `SELECT u.name, p.recertificacao, p.revisoes FROM "User" u JOIN "NotificationPreference" p ON p."userId" = u.id WHERE u.id = $1`,
    [conta.id],
  );
  expect(r.rows[0]).toEqual({ name: "Nome Novo", recertificacao: false, revisoes: true });
});

test("excluir conta pede senha e EXCLUIR, apaga os dados e encerra a sessão", async ({ context, page }) => {
  const conta = await criarConta("del", { senha: "Excluir-Mesmo-2026" });
  await entrarComo(context, conta);

  await page.goto("/conta");
  await page.getByRole("button", { name: "Excluir conta" }).click();
  const dialogo = page.getByRole("dialog", { name: "Excluir conta" });
  await dialogo.getByLabel("Sua senha").fill("senha-errada-1");
  await dialogo.getByLabel(/Digite "EXCLUIR"/).fill("EXCLUIR");
  await dialogo.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(dialogo.getByText("Senha incorreta.")).toBeVisible();

  await dialogo.getByLabel("Sua senha").fill("Excluir-Mesmo-2026");
  await dialogo.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page).toHaveURL(/\/\?conta=excluida$/);
  await expect(page.getByText("Sua conta foi excluída")).toBeVisible();

  const r = await banco().query(`SELECT 1 FROM "User" WHERE id = $1`, [conta.id]);
  expect(r.rowCount).toBe(0);
  await page.goto("/conta");
  await expect(page).toHaveURL(/\/entrar/);
});

test("sair encerra a sessão no banco", async ({ context, page }) => {
  const conta = await criarConta("sair");
  await entrarComo(context, conta);
  await page.goto("/conta");
  await page.getByRole("button", { name: "Sair desta conta" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  const r = await banco().query(`SELECT 1 FROM "Session" WHERE "userId" = $1`, [conta.id]);
  expect(r.rowCount).toBe(0);
  await page.goto("/hoje");
  await expect(page).toHaveURL(/\/entrar/);
});

test("telas de conta sem violações de acessibilidade", async ({ context, page }) => {
  for (const rota of ["/entrar", "/cadastro", "/esqueci-senha", "/termos", "/privacidade"]) {
    await page.goto(rota);
    expect(await violacoesA11y(page), rota).toEqual([]);
  }
  const conta = await criarConta("a11y", { confirmado: false });
  await entrarComo(context, conta);
  for (const rota of ["/hoje", "/conta"]) {
    await page.goto(rota);
    expect(await violacoesA11y(page), rota).toEqual([]);
  }
});
