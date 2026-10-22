import { z } from "zod";
import { normalizarEmail, validarSenha, SENHA_MAX } from "./politica";

/** Schemas de entrada da autenticação e da conta. Seguros para o cliente. */

export const emailSchema = z
  .string({ error: "Informe seu e-mail." })
  .trim()
  .min(1, "Informe seu e-mail.")
  .max(254, "E-mail longo demais.")
  .transform(normalizarEmail)
  .pipe(z.email("Informe um e-mail válido."));

export const nomeSchema = z
  .string({ error: "Informe seu nome." })
  .trim()
  .min(2, "Informe seu nome.")
  .max(80, "Use no máximo 80 caracteres.");

/** Senha nova: aplica a política (tamanho e lista de senhas comuns). */
export const novaSenhaSchema = z.string({ error: "Informe uma senha." }).superRefine((senha, ctx) => {
  const erro = validarSenha(senha);
  if (erro) ctx.addIssue({ code: "custom", message: erro });
});

/** Senha atual/digitada no login: só limites de tamanho, sem política. */
export const senhaInformadaSchema = z
  .string({ error: "Informe sua senha." })
  .min(1, "Informe sua senha.")
  .max(SENHA_MAX, "Senha incorreta.");

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Link inválido.");

export const cadastroSchema = z
  .object({
    nome: nomeSchema,
    email: emailSchema,
    senha: novaSenhaSchema,
    aceiteTermos: z.boolean().refine((v) => v, "Para criar a conta, aceite os termos e a política de privacidade."),
  })
  .superRefine((d, ctx) => {
    const erro = validarSenha(d.senha, { email: d.email });
    if (erro && !validarSenha(d.senha)) ctx.addIssue({ code: "custom", path: ["senha"], message: erro });
  });

export const loginSchema = z.object({
  email: emailSchema,
  senha: senhaInformadaSchema,
  voltar: z.string().max(512).optional(),
});

export const esqueciSchema = z.object({ email: emailSchema });

export const redefinirSchema = z
  .object({
    token: tokenSchema,
    senha: novaSenhaSchema,
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, { path: ["confirmacao"], message: "As senhas não conferem." });

export const trocarSenhaSchema = z
  .object({
    senhaAtual: senhaInformadaSchema,
    novaSenha: novaSenhaSchema,
    confirmacao: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmacao, { path: ["confirmacao"], message: "As senhas não conferem." })
  .refine((d) => d.novaSenha !== d.senhaAtual, {
    path: ["novaSenha"],
    message: "A nova senha deve ser diferente da atual.",
  });

export const dadosSchema = z.object({ nome: nomeSchema });

export const preferenciasSchema = z.object({
  revisoes: z.boolean(),
  mudancaExame: z.boolean(),
  recertificacao: z.boolean(),
  avisosPagamento: z.boolean(),
});

export const excluirContaSchema = z.object({
  senha: senhaInformadaSchema,
  confirmacao: z.string().refine((v) => v.trim().toUpperCase() === "EXCLUIR", "Digite EXCLUIR para confirmar."),
});

export type CadastroInput = z.input<typeof cadastroSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type EsqueciInput = z.input<typeof esqueciSchema>;
export type RedefinirInput = z.input<typeof redefinirSchema>;
export type TrocarSenhaInput = z.input<typeof trocarSenhaSchema>;
export type DadosInput = z.input<typeof dadosSchema>;
export type PreferenciasInput = z.input<typeof preferenciasSchema>;
export type ExcluirContaInput = z.input<typeof excluirContaSchema>;

/** Converte erros do Zod no formato de `fieldErrors` do ActionResult. */
export function errosDeCampo(error: z.ZodError): Record<string, string[]> {
  const saida: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const campo = issue.path.join(".") || "_";
    (saida[campo] ??= []).push(issue.message);
  }
  return saida;
}
