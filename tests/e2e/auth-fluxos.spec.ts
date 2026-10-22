import { expect, test, type Page } from "@playwright/test";
import { criarConta, emailUnico } from "./apoio/contas";
import { banco, fecharBanco } from "./apoio/db";
import { aguardarEmail, linkDoEmail } from "./apoio/emails";

test.afterAll(async () => {
  await fecharBanco();
});

async function sairPeloMenu(page: Page) {
  await page.getByRole("button", { name: /^Menu de/ }).filter({ visible: true }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar/);
}

async function entrar(page: Page, email: string, senha: string) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("cadastro → e-mail de confirmação → confirmar → login", async ({ page }) => {
  const email = emailUnico("cad");
  const senha = "Cadeira-Azul-2026";

  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Maria Cadastro");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByLabel(/Li e aceito os/).check();
  await page.getByRole("button", { name: "Criar conta" }).click();

  // Conta criada e já logada, mas sem confirmar o e-mail.
  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByRole("heading", { level: 1, name: "Olá, Maria" })).toBeVisible();
  await expect(page.getByText(`Confirme seu e-mail ${email}`)).toBeVisible();
  const linha = await banco().query<{ emailVerifiedAt: Date | null; consentimentos: number }>(
    `SELECT u."emailVerifiedAt", (SELECT count(*)::int FROM "Consent" c WHERE c."userId" = u.id) AS consentimentos
     FROM "User" u WHERE u.email = $1`,
    [email],
  );
  expect(linha.rows[0]?.emailVerifiedAt).toBeNull();
  expect(linha.rows[0]?.consentimentos).toBe(2);

  const mensagem = await aguardarEmail(email, "Confirme seu e-mail");
  const link = linkDoEmail(mensagem, "/confirmar-email");

  await sairPeloMenu(page);

  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "E-mail confirmado" })).toBeVisible();
  // O link é de uso único.
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "Link inválido" })).toBeVisible();
  await expect(page.getByText("Este link já foi usado.")).toBeVisible();

  await page.goto("/entrar");
  await entrar(page, email, "senha-errada-123");
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await entrar(page, email, senha);
  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByText(`Confirme seu e-mail ${email}`)).toHaveCount(0);
});

test("esqueci senha → link → nova senha → sessão antiga revogada → login com a nova", async ({ browser, page }) => {
  const senhaAntiga = "Senha-Antiga-2026";
  const senhaNova = "Senha-Nova-Bem-Forte-2026";
  const conta = await criarConta("reset", { senha: senhaAntiga, comSessao: false });

  // Outro navegador já logado com a senha antiga.
  const outro = await browser.newContext();
  const antiga = await outro.newPage();
  await antiga.goto("/entrar");
  await entrar(antiga, conta.email, senhaAntiga);
  await expect(antiga).toHaveURL(/\/hoje$/);

  await page.goto("/entrar");
  await page.getByRole("link", { name: /Esqueci/ }).click();
  await expect(page).toHaveURL(/\/esqueci-senha$/);
  await page.getByLabel("E-mail").fill(conta.email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Se o e-mail estiver cadastrado" })).toBeVisible();

  const mensagem = await aguardarEmail(conta.email, "Redefinição de senha");
  const link = linkDoEmail(mensagem, "/redefinir-senha");
  await page.goto(link);
  await page.getByLabel("Nova senha", { exact: true }).fill(senhaNova);
  await page.getByLabel("Repita a nova senha").fill(senhaNova);
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page).toHaveURL(/\/entrar\?redefinida=1/);
  await expect(page.getByText("Senha alterada. Entre com a nova senha.")).toBeVisible();
  await aguardarEmail(conta.email, "Sua senha foi alterada");

  // A sessão do outro navegador foi revogada.
  await antiga.goto("/hoje");
  await expect(antiga).toHaveURL(/\/entrar/);
  await outro.close();

  // O link não vale de novo.
  await page.goto(link);
  await expect(page.getByText(/Este link já foi usado/)).toBeVisible();

  await page.goto("/entrar");
  await entrar(page, conta.email, senhaAntiga);
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await entrar(page, conta.email, senhaNova);
  await expect(page).toHaveURL(/\/hoje$/);
});

test("login volta para a página privada que pediu e recusa destino externo", async ({ page }) => {
  const conta = await criarConta("voltar", { senha: "Voltar-Certo-2026", comSessao: false });
  await page.goto("/conta");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fconta/);
  await entrar(page, conta.email, "Voltar-Certo-2026");
  await expect(page).toHaveURL(/\/conta$/);

  await page.context().clearCookies();
  await page.goto("/entrar?voltar=//evil.example");
  await entrar(page, conta.email, "Voltar-Certo-2026");
  await expect(page).toHaveURL(/\/hoje$/);
});
