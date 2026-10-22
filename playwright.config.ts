import "dotenv/config";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { chromium, defineConfig, devices } from "@playwright/test";

const PORTA = 3100;
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
  webServer: {
    command: `npm run build && npm run start -- -p ${PORTA}`,
    url: BASE_URL,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      DATABASE_URL,
      APP_URL: BASE_URL,
      // Testes nunca falam com serviços reais.
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      GEMINI_API_KEY: "",
      STRIPE_SECRET_KEY: "",
    },
  },
});
