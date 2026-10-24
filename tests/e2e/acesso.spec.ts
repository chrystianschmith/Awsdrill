import { expect, test } from "@playwright/test";
import { SESSION_COOKIE_E2E } from "./apoio/constantes";

test.describe("sem sessão", () => {
  test("exportação responde 401 e /conta manda para /entrar", async ({ page }) => {
    const r = await page.request.get("/api/conta/exportar");
    expect(r.status()).toBe(401);
    await page.goto("/conta");
    await expect(page).toHaveURL(/\/entrar\?voltar=%2Fconta/);
  });

  test("cookie forjado não abre área logada nem exportação", async ({ context, page }) => {
    await context.addCookies([
      {
        name: SESSION_COOKIE_E2E,
        value: "A".repeat(43),
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/conta");
    await expect(page).toHaveURL(/\/entrar/);
    expect((await page.request.get("/api/conta/exportar")).status()).toBe(401);
  });

  test("cron de limpeza recusa chamada sem o segredo", async ({ request }) => {
    expect((await request.get("/api/cron/limpeza")).status()).toBe(401);
    expect((await request.get("/api/cron/limpeza", { headers: { authorization: "Bearer chute" } })).status()).toBe(401);
  });
});
