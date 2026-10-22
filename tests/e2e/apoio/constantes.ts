import path from "node:path";
import { SESSION_COOKIE } from "../../../src/lib/auth/cookie";

export const DOMINIO_E2E = "e2e.test";
export const SESSION_COOKIE_E2E = SESSION_COOKIE;

/** Pasta onde o app grava os e-mails nos testes (EMAIL_SINK_DIR). */
export const PASTA_EMAILS = path.join(__dirname, "..", ".emails");
