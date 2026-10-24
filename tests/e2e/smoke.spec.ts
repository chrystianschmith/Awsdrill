import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("páginas públicas", () => {
  test("início mostra proposta, primeiros exames e aviso de não afiliação", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const codigo of ["CLF-C02", "AIF-C01", "SAA-C03"]) await expect(page.getByText(codigo)).toBeVisible();
    await expect(page.getByText(/Não somos afiliados/)).toBeVisible();
    await expect(page).toHaveTitle(/certificações de nuvem/);
  });

  test("sem rolagem horizontal", async ({ page }) => {
    await page.goto("/");
    const largura = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(largura).toBeLessThanOrEqual(0);
  });

  test("404 com link para o início", async ({ page }) => {
    const res = await page.goto("/pagina-que-nao-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o início" })).toHaveAttribute("href", "/");
  });

  test("página offline e manifesto do PWA", async ({ page, request }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();

    const manifesto = await request.get("/manifest.webmanifest");
    expect(manifesto.ok()).toBe(true);
    const json = (await manifesto.json()) as { icons: { src: string; purpose?: string }[]; start_url: string };
    expect(json.start_url).toBe("/");
    expect(json.icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const i of json.icons) expect((await request.get(i.src)).ok(), i.src).toBe(true);
    expect((await request.get("/sw.js")).ok()).toBe(true);
    expect((await request.get("/apple-icon.png")).ok()).toBe(true);
  });

  test("rota privada sem sessão leva para /entrar", async ({ request }) => {
    const res = await request.get("/hoje", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toContain("/entrar?voltar=%2Fhoje");
  });
});

test.describe("segurança e acessibilidade", () => {
  test("headers de segurança na resposta de produção", async ({ request }) => {
    const h = (await request.get("/")).headers();
    expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
    expect(h["content-security-policy"]).not.toContain("unsafe-eval");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  for (const tema of ["claro", "escuro"] as const) {
    test(`início sem violações de acessibilidade (tema ${tema})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("tema", t), tema);
      await page.goto("/");
      const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(resultado.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }
});
