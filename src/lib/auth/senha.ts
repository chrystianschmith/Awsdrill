import "server-only";
import { hash, verify, type Options } from "@node-rs/argon2";

export { normalizarEmail, validarSenha, SENHA_MIN, SENHA_MAX } from "./politica";

/** Parâmetros mínimos recomendados pela OWASP para argon2id. */
export const ARGON2_OPCOES = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  // Algorithm.Argon2id (const enum não é acessível com isolatedModules).
  algorithm: 2,
} satisfies Options;

export async function hashSenha(senha: string): Promise<string> {
  return hash(senha, ARGON2_OPCOES);
}

/** Verifica a senha; hash malformado conta como senha errada. */
export async function verificarSenha(hashArmazenado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha);
  } catch {
    return false;
  }
}

let hashFicticio: Promise<string> | undefined;

/**
 * Verifica contra um hash fictício para que o login com e-mail inexistente
 * leve um tempo parecido com o de um e-mail existente. Sempre retorna false.
 */
export async function verificarSenhaFicticia(senha: string): Promise<false> {
  hashFicticio ??= hashSenha("senha-ficticia-para-equalizar-tempo");
  await verificarSenha(await hashFicticio, senha);
  return false;
}
