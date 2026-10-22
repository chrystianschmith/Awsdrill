import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import type { BrowserContext } from "@playwright/test";
import { gerarToken, hashToken } from "../../../src/lib/auth/tokens";
import { DOMINIO_E2E, SESSION_COOKIE_E2E } from "./constantes";
import { banco, novoId } from "./db";

const DIA = 24 * 60 * 60 * 1000;

export type ContaE2E = { id: string; email: string; nome: string; senha: string | null; token: string | null };

export type OpcoesConta = {
  nome?: string;
  /** Senha real (argon2id); sem ela a conta só entra pelo cookie gravado. */
  senha?: string;
  admin?: boolean;
  confirmado?: boolean;
  /** Grava uma sessão de login (padrão: sim). */
  comSessao?: boolean;
};

/** Mesmos parâmetros de src/lib/auth/senha.ts (que importa server-only). */
const hashSenhaE2E = (senha: string) => hash(senha, { memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 });

/** E-mail único @e2e.test (apagado pelo global-setup). */
export function emailUnico(prefixo: string): string {
  return `${prefixo}-${randomBytes(4).toString("hex")}@${DOMINIO_E2E}`;
}

/** Cria um usuário de teste direto no banco, com aceites e preferências como no cadastro. */
export async function criarConta(prefixo: string, o: OpcoesConta = {}): Promise<ContaE2E> {
  const db = banco();
  const id = novoId();
  const email = emailUnico(prefixo);
  const nome = o.nome ?? `Teste ${prefixo}`;
  const passwordHash = o.senha ? await hashSenhaE2E(o.senha) : "sem-login-por-senha";
  await db.query(
    `INSERT INTO "User" (id, name, email, "passwordHash", role, "emailVerifiedAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,now())`,
    [id, nome, email, passwordHash, o.admin ? "ADMIN" : "USER", o.confirmado === false ? null : new Date()],
  );
  await db.query(`INSERT INTO "NotificationPreference" ("userId") VALUES ($1)`, [id]);
  for (const kind of ["TERMOS", "PRIVACIDADE"]) {
    await db.query(`INSERT INTO "Consent" (id, "userId", kind, version) VALUES ($1,$2,$3,'2026-10')`, [novoId(), id, kind]);
  }
  let token: string | null = null;
  if (o.comSessao !== false) {
    token = gerarToken();
    await db.query(`INSERT INTO "Session" (id, "userId", "tokenHash", "expiresAt") VALUES ($1,$2,$3,$4)`, [
      novoId(),
      id,
      hashToken(token),
      new Date(Date.now() + 7 * DIA),
    ]);
  }
  return { id, email, nome, senha: o.senha ?? null, token };
}

/** Entra no contexto do navegador com o cookie de sessão da conta. */
export async function entrarComo(context: BrowserContext, conta: ContaE2E) {
  if (!conta.token) throw new Error("Conta criada sem sessão.");
  await context.addCookies([
    {
      name: SESSION_COOKIE_E2E,
      value: conta.token,
      domain: "localhost",
      path: "/",
      expires: Math.floor((Date.now() + 7 * DIA) / 1000),
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}
