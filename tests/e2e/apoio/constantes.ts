import path from "node:path";
import { SESSION_COOKIE } from "../../../src/lib/auth/cookie";

export const DOMINIO_E2E = "e2e.test";
export const SESSION_COOKIE_E2E = SESSION_COOKIE;

export const PORTA_APP = 3100;
export const URL_APP = `http://localhost:${PORTA_APP}`;

/** Servidor falso do Stripe (tests/e2e/apoio/stripe-mock.ts). */
export const PORTA_STRIPE_MOCK = 12111;
export const URL_STRIPE_MOCK = `http://localhost:${PORTA_STRIPE_MOCK}`;
/** Segredo de webhook só de teste, compartilhado entre o app e o mock. */
export const WEBHOOK_SECRET_E2E = "whsec_e2e_segredo_de_teste_nao_usar_em_producao"; // gitleaks:allow (só teste)
export const PRECOS_E2E = {
  MENSAL: "price_e2e_mensal",
  ANUAL: "price_e2e_anual",
  ANUAL_PIX: "price_e2e_anual_pix",
} as const;

/** Pasta onde o app grava os e-mails nos testes (EMAIL_SINK_DIR). */
export const PASTA_EMAILS = path.join(__dirname, "..", ".emails");
