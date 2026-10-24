import "dotenv/config";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { chromium, defineConfig, devices } from "@playwright/test";
import { PASTA_EMAILS, PORTA_APP, PRECOS_E2E, URL_STRIPE_MOCK, WEBHOOK_SECRET_E2E } from "./tests/e2e/apoio/constantes";

const PORTA = PORTA_APP;
const BASE_URL = `http://localhost:${PORTA}`;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

/**
 * Usa o Chromium que o Playwright espera; se a revisão exata não estiver em
 * PLAYWRIGHT_BROWSERS_PATH (ambiente sem `playwright install`), usa o Chromium
 * disponível lá. Nunca baixa navegador.
 */
function chromiumDisponivel(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  try {
    if (existsSync(chromium.executablePath())) return undefined;
  } catch {
    // segue para a busca manual
  }
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !existsSync(base)) return undefined;
  const candidatos = readdirSync(base)
    .sort()
    .reverse()
    .flatMap((d) => [
      path.join(base, d, "chrome-linux", "headless_shell"),
      path.join(base, d, "chrome-linux", "chrome"),
      path.join(base, d, "chrome-linux64", "chrome"),
    ]);
  return candidatos.find((c) => existsSync(c));
}

const executablePath = chromiumDisponivel();

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 740 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      // Stripe falso (sem rede): checkout, portal, assinaturas, faturas e webhooks assinados.
      command: "npx tsx tests/e2e/apoio/stripe-mock.ts",
      url: `${URL_STRIPE_MOCK}/health`,
      timeout: 30_000,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
      env: { APP_URL: BASE_URL, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET_E2E },
    },
    {
      command: `npm run build && npm run start -- -p ${PORTA}`,
      url: BASE_URL,
      timeout: 300_000,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
      env: {
        DATABASE_URL,
        APP_URL: BASE_URL,
        // Testes nunca falam com serviços reais; o Stripe é o mock acima.
        RESEND_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        GEMINI_API_KEY: "",
        STRIPE_SECRET_KEY: "sk_test_e2e",
        STRIPE_API_BASE: URL_STRIPE_MOCK,
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET_E2E,
        STRIPE_PRICE_MENSAL: PRECOS_E2E.MENSAL,
        STRIPE_PRICE_ANUAL: PRECOS_E2E.ANUAL,
        STRIPE_PRICE_ANUAL_PIX: PRECOS_E2E.ANUAL_PIX,
        // E-mails vão para arquivos que os testes leem (src/lib/email/send.ts).
        E2E: "1",
        EMAIL_SINK_DIR: PASTA_EMAILS,
      },
    },
  ],
});
