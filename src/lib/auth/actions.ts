"use server";

import { createElement } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { log } from "@/lib/log";
import { sendEmail } from "@/lib/email/send";
import { EmailConfirmacao } from "@/emails/auth/confirmacao";
import { EmailRedefinirSenha } from "@/emails/auth/redefinir-senha";
import { EmailSenhaAlterada } from "@/emails/auth/senha-alterada";
import { audit } from "./audit";
import {
  emitirTokenConfirmacao,
  emitirTokenReset,
  excluirDadosDoUsuario,
  redefinirSenhaComToken,
  VERSAO_TERMOS,
} from "./fluxos";
import { chaveLimite, exigirLimite, limparLimite, LIMITES, RateLimitError } from "./rate-limit";
import { getIp, getUserAgent } from "./request";
import {
  cadastroSchema,
  dadosSchema,
  errosDeCampo,
  esqueciSchema,
  excluirContaSchema,
  loginSchema,
  preferenciasSchema,
  redefinirSchema,
  trocarSenhaSchema,
  type CadastroInput,
  type DadosInput,
  type EsqueciInput,
  type ExcluirContaInput,
  type LoginInput,
  type PreferenciasInput,
  type RedefinirInput,
  type TrocarSenhaInput,
} from "./schemas";
import { hashSenha, validarSenha, verificarSenha, verificarSenhaFicticia } from "./senha";
import { criarSessao, encerrarSessao, getCurrentUser, requireUser, revogarSessoes } from "./session";
import { cancelarAssinaturaDoUsuario } from "./stripe-cancel";
import { destinoSeguro } from "./voltar";

const MSG_LOGIN = "E-mail ou senha incorretos.";
const MSG_CAMPOS = "Confira os campos destacados.";
const MSG_ESQUECI =
  "Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Confira sua caixa de entrada e o spam.";
const MSG_TOKEN = {
  inexistente: "Este link é inválido. Peça um novo.",
  expirado: "Este link expirou. Peça um novo.",
  usado: "Este link já foi usado. Peça um novo se precisar.",
} as const;

/** Converte RateLimitError em resposta amigável; outros erros sobem. */
async function comLimite(fn: () => Promise<void>): Promise<ActionResult<never> | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof RateLimitError) return fail(e.message, "rate_limit");
    throw e;
  }
}

function urlApp(caminho: string): string {
  return `${env().APP_URL.replace(/\/$/, "")}${caminho}`;
}

/** Envia o e-mail depois da resposta; falha de envio só vai para o log. */
function enviarDepois(enviar: () => Promise<void>, evento: string) {
  after(async () => {
    try {
      await enviar();
    } catch (e) {
      log("error", evento, { erro: e instanceof Error ? e.message : String(e) });
    }
  });
}

function agendarConfirmacao(nome: string, email: string, token: string) {
  const link = urlApp(`/confirmar-email?token=${token}`);
  enviarDepois(
    () =>
      sendEmail({
        to: email,
        subject: "Confirme seu e-mail",
        react: createElement(EmailConfirmacao, { nome, link, appUrl: urlApp("") }),
      }),
    "auth.email_confirmacao_falhou",
  );
}

function agendarAvisoSenhaAlterada(nome: string, email: string) {
  const quando = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  enviarDepois(
    () =>
      sendEmail({
        to: email,
        subject: "Sua senha foi alterada",
        react: createElement(EmailSenhaAlterada, { nome, quando, appUrl: urlApp("") }),
      }),
    "auth.email_senha_alterada_falhou",
  );
}

/** Violação de unicidade (e-mail cadastrado entre a checagem e o insert). */
function erroUnico(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// ─── Cadastro, login e logout ──────────────────────────────────────

export async function cadastrar(input: CadastroInput): Promise<ActionResult> {
  const parsed = cadastroSchema.safeParse(input);
  if (!parsed.success) return fail(MSG_CAMPOS, "validacao", errosDeCampo(parsed.error));
  const { nome, email, senha } = parsed.data;
  const ip = await getIp();

  const bloqueio = await comLimite(() => exigirLimite(chaveLimite("cadastro:ip", ip), LIMITES.cadastroIp));
  if (bloqueio) return bloqueio;

  const msgEmail = "Não foi possível usar este e-mail. Se você já tem conta, entre ou recupere a senha.";
  const existente = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existente) return fail(MSG_CAMPOS, "email_em_uso", { email: [msgEmail] });

  const passwordHash = await hashSenha(senha);
  let userId: string;
  try {
    const user = await db.user.create({
      data: {
        name: nome,
        email,
        passwordHash,
        consents: {
          create: [
            { kind: "TERMOS", version: VERSAO_TERMOS, ip },
            { kind: "PRIVACIDADE", version: VERSAO_TERMOS, ip },
          ],
        },
        notificationPreference: { create: {} },
      },
      select: { id: true },
    });
    userId = user.id;
  } catch (e) {
    if (!erroUnico(e)) throw e;
    return fail(MSG_CAMPOS, "email_em_uso", { email: [msgEmail] });
  }

  const token = await emitirTokenConfirmacao(userId);
  agendarConfirmacao(nome, email, token);
  await criarSessao(userId, await getUserAgent());
  await audit("cadastro", userId, { versaoTermos: VERSAO_TERMOS }, ip);
  redirect("/hoje");
}

export async function entrar(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(MSG_CAMPOS, "validacao", errosDeCampo(parsed.error));
  const { email, senha, voltar } = parsed.data;
  const ip = await getIp();
  const chaveEmail = chaveLimite("login:email", email);

  const bloqueio = await comLimite(async () => {
    await exigirLimite(chaveLimite("login:ip", ip), LIMITES.loginIp);
    await exigirLimite(chaveEmail, LIMITES.loginEmail);
  });
  if (bloqueio) return bloqueio;

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, deletedAt: true },
  });
  const senhaOk =
    user && !user.deletedAt ? await verificarSenha(user.passwordHash, senha) : await verificarSenhaFicticia(senha);
  if (!user || !senhaOk) {
    // Depois da resposta: a escrita extra não pode revelar pelo tempo que o e-mail existe.
    if (user) enviarDepois(() => audit("login.falhou", user.id, undefined, ip), "auth.audit_login_falhou");
    return fail(MSG_LOGIN, "credenciais");
  }

  await criarSessao(user.id, await getUserAgent());
  await limparLimite(chaveEmail);
  await audit("login", user.id, undefined, ip);
  redirect(destinoSeguro(voltar));
}

export async function sair(): Promise<void> {
  const user = await getCurrentUser();
  await encerrarSessao();
  if (user) await audit("logout", user.id, undefined, await getIp());
  redirect("/entrar");
}

// ─── Confirmação de e-mail ─────────────────────────────────────────

export async function reenviarConfirmacao(): Promise<ActionResult> {
  const user = await requireUser();
  if (user.emailVerified) return fail("Seu e-mail já está confirmado.", "ja_confirmado");
  const bloqueio = await comLimite(() =>
    exigirLimite(chaveLimite("confirmacao:usuario", user.id), LIMITES.confirmacaoUsuario),
  );
  if (bloqueio) return bloqueio;
  const token = await emitirTokenConfirmacao(user.id);
  agendarConfirmacao(user.name, user.email, token);
  return ok(undefined);
}

// ─── Esqueci / redefinir senha ─────────────────────────────────────

export async function esqueciSenha(input: EsqueciInput): Promise<ActionResult<{ mensagem: string }>> {
  const parsed = esqueciSchema.safeParse(input);
  if (!parsed.success) return fail(MSG_CAMPOS, "validacao", errosDeCampo(parsed.error));
  const { email } = parsed.data;

  const bloqueio = await comLimite(() => exigirLimite(chaveLimite("reset:email", email), LIMITES.resetEmail));
  if (bloqueio) return bloqueio;

  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, deletedAt: true } });
  if (user && !user.deletedAt) {
    const ip = await getIp();
    // Token, e-mail e auditoria só depois da resposta: as escritas extras no banco não podem
    // deixar a resposta mais lenta para e-mails cadastrados (enumeração por tempo).
    enviarDepois(async () => {
      const token = await emitirTokenReset(user.id);
      const link = urlApp(`/redefinir-senha?token=${token}`);
      await audit("senha.reset_solicitado", user.id, undefined, ip);
      await sendEmail({
        to: email,
        subject: "Redefinição de senha",
        react: createElement(EmailRedefinirSenha, { nome: user.name, link, appUrl: urlApp("") }),
      });
    }, "auth.email_reset_falhou");
  }
  return ok({ mensagem: MSG_ESQUECI });
}

export async function redefinirSenha(input: RedefinirInput): Promise<ActionResult> {
  const parsed = redefinirSchema.safeParse(input);
  if (!parsed.success) {
    const campos = errosDeCampo(parsed.error);
    if (campos.token) return fail(MSG_TOKEN.inexistente, "token_inexistente");
    return fail(MSG_CAMPOS, "validacao", campos);
  }
  const resultado = await redefinirSenhaComToken(parsed.data.token, parsed.data.senha);
  if (resultado.estado !== "ok") return fail(MSG_TOKEN[resultado.estado], `token_${resultado.estado}`);

  await audit("senha.redefinida", resultado.userId, undefined, await getIp());
  agendarAvisoSenhaAlterada(resultado.nome, resultado.email);
  redirect("/entrar?redefinida=1");
}

// ─── Conta (logado) ────────────────────────────────────────────────

export async function trocarSenha(input: TrocarSenhaInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = trocarSenhaSchema.safeParse(input);
  if (!parsed.success) return fail(MSG_CAMPOS, "validacao", errosDeCampo(parsed.error));

  const bloqueio = await comLimite(() => exigirLimite(chaveLimite("troca:usuario", user.id), LIMITES.senhaUsuario));
  if (bloqueio) return bloqueio;

  const atual = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verificarSenha(atual.passwordHash, parsed.data.senhaAtual))) {
    return fail(MSG_CAMPOS, "senha_atual", { senhaAtual: ["Senha atual incorreta."] });
  }
  const erroSenha = validarSenha(parsed.data.novaSenha, { email: user.email });
  if (erroSenha) return fail(MSG_CAMPOS, "validacao", { novaSenha: [erroSenha] });

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashSenha(parsed.data.novaSenha) } });
  await revogarSessoes(user.id, true);
  await db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await audit("senha.trocada", user.id, undefined, await getIp());
  agendarAvisoSenhaAlterada(user.name, user.email);
  return ok(undefined);
}

export async function atualizarDados(input: DadosInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = dadosSchema.safeParse(input);
  if (!parsed.success) return fail(MSG_CAMPOS, "validacao", errosDeCampo(parsed.error));
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.nome } });
  revalidatePath("/", "layout");
  return ok(undefined);
}

export async function atualizarPreferencias(input: PreferenciasInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = preferenciasSchema.safeParse(input);
  if (!parsed.success) return fail(MSG_CAMPOS, "validacao", errosDeCampo(parsed.error));
  await db.notificationPreference.upsert({
    where: { userId: user.id },
    create: { ...parsed.data, userId: user.id },
    update: parsed.data,
  });
  revalidatePath("/conta");
  return ok(undefined);
}

export async function excluirConta(input: ExcluirContaInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = excluirContaSchema.safeParse(input);
  if (!parsed.success) return fail(MSG_CAMPOS, "validacao", errosDeCampo(parsed.error));

  const bloqueio = await comLimite(() => exigirLimite(chaveLimite("exclusao:usuario", user.id), LIMITES.senhaUsuario));
  if (bloqueio) return bloqueio;

  const atual = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verificarSenha(atual.passwordHash, parsed.data.senha))) {
    return fail(MSG_CAMPOS, "senha_incorreta", { senha: ["Senha incorreta."] });
  }

  // Cancela no Stripe antes de apagar: sem isso a cobrança continuaria sem conta.
  try {
    await cancelarAssinaturaDoUsuario(user.id);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Não foi possível excluir a conta agora.", "stripe");
  }

  // O registro fica sem userId após a exclusão (onDelete: SetNull) e sem dados pessoais.
  await audit("conta.excluida", user.id);
  await excluirDadosDoUsuario(user.id);
  await encerrarSessao();
  redirect("/?conta=excluida");
}
