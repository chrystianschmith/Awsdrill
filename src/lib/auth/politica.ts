import { senhaComum } from "./senhas-comuns";

export const SENHA_MIN = 8;
/** Teto para evitar abuso de CPU/memória no hash. */
export const SENHA_MAX = 128;

/** Minúsculas, sem espaços nas pontas e em forma Unicode NFC. */
export function normalizarEmail(email: string): string {
  return email.normalize("NFC").trim().toLowerCase();
}

/**
 * Política de senha. Retorna a mensagem de erro em pt-BR ou null se a senha
 * for aceita. Função pura, usada no cliente (Zod) e no servidor.
 */
export function validarSenha(senha: string, contexto: { email?: string } = {}): string | null {
  if (senha.length < SENHA_MIN) return `Use pelo menos ${SENHA_MIN} caracteres.`;
  if (senha.length > SENHA_MAX) return `Use no máximo ${SENHA_MAX} caracteres.`;
  if (senha.trim().length === 0) return "A senha não pode ser só espaços.";
  if (senhaComum(senha)) return "Essa senha é muito comum. Escolha outra.";
  const s = senha.toLowerCase();
  const email = contexto.email ? normalizarEmail(contexto.email) : "";
  if (email && (s === email || s === email.split("@")[0])) return "A senha não pode ser igual ao seu e-mail.";
  return null;
}
