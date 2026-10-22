import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  confirmarEmailComToken,
  emitirTokenConfirmacao,
  emitirTokenReset,
  estadoTokenReset,
  excluirDadosDoUsuario,
  exportarDadosDoUsuario,
  redefinirSenhaComToken,
} from "@/lib/auth/fluxos";
import { consumir, limparLimite } from "@/lib/auth/rate-limit";
import { hashSenha, verificarSenha } from "@/lib/auth/senha";
import { gerarToken, hashToken } from "@/lib/auth/tokens";

const prefixo = `it-${randomUUID().slice(0, 8)}`;
const criados: string[] = [];
let senhaHash: string;

async function criarUsuario() {
  senhaHash ??= await hashSenha("senha-antiga-1");
  const sufixo = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: {
      name: "Teste",
      email: `${prefixo}-${sufixo}@exemplo.test`,
      passwordHash: senhaHash,
      notificationPreference: { create: {} },
    },
  });
  criados.push(user.id);
  return user;
}

async function criarSessoes(userId: string, n: number) {
  for (let i = 0; i < n; i++) {
    await db.session.create({
      data: { userId, tokenHash: hashToken(gerarToken()), expiresAt: new Date(Date.now() + 86_400_000) },
    });
  }
}

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: criados } } });
  await db.rateLimit.deleteMany({ where: { key: { startsWith: prefixo } } });
  await db.$disconnect();
});

describe("redefinição de senha", () => {
  let userId: string;
  beforeEach(async () => {
    userId = (await criarUsuario()).id;
    await criarSessoes(userId, 3);
  });

  it("fluxo completo: troca o hash, marca o token e revoga todas as sessões", async () => {
    const token = await emitirTokenReset(userId);
    expect(await estadoTokenReset(token)).toBe("valido");

    const r = await redefinirSenhaComToken(token, "nova-senha-forte-7");
    expect(r.estado).toBe("ok");

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verificarSenha(user.passwordHash, "nova-senha-forte-7")).toBe(true);
    expect(await verificarSenha(user.passwordHash, "senha-antiga-1")).toBe(false);
    expect(await db.session.count({ where: { userId } })).toBe(0);
    expect(await estadoTokenReset(token)).toBe("usado");
  });

  it("token reutilizado é recusado", async () => {
    const token = await emitirTokenReset(userId);
    expect((await redefinirSenhaComToken(token, "nova-senha-forte-7")).estado).toBe("ok");
    expect((await redefinirSenhaComToken(token, "outra-senha-forte-8")).estado).toBe("usado");
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verificarSenha(user.passwordHash, "nova-senha-forte-7")).toBe(true);
  });

  it("token expirado (após 30 min) é recusado e não altera nada", async () => {
    const emitidoEm = new Date();
    const token = await emitirTokenReset(userId, emitidoEm);
    const depois = new Date(emitidoEm.getTime() + 30 * 60_000 + 1);
    expect(await estadoTokenReset(token, depois)).toBe("expirado");
    expect((await redefinirSenhaComToken(token, "nova-senha-forte-7", depois)).estado).toBe("expirado");
    expect(await db.session.count({ where: { userId } })).toBe(3);
  });

  it("novo pedido invalida os tokens anteriores", async () => {
    const primeiro = await emitirTokenReset(userId);
    const segundo = await emitirTokenReset(userId);
    expect(await estadoTokenReset(primeiro)).toBe("usado");
    expect(await estadoTokenReset(segundo)).toBe("valido");
  });

  it("token desconhecido ou malformado é inexistente", async () => {
    expect((await redefinirSenhaComToken(gerarToken(), "nova-senha-forte-7")).estado).toBe("inexistente");
    expect((await redefinirSenhaComToken("abc", "nova-senha-forte-7")).estado).toBe("inexistente");
  });

  it("só o hash do token é guardado", async () => {
    const token = await emitirTokenReset(userId);
    const registros = await db.passwordResetToken.findMany({ where: { userId } });
    expect(registros.some((r) => r.tokenHash === token)).toBe(false);
    expect(registros.some((r) => r.tokenHash === hashToken(token))).toBe(true);
  });
});

describe("confirmação de e-mail", () => {
  it("confirma uma vez e recusa reuso", async () => {
    const user = await criarUsuario();
    const token = await emitirTokenConfirmacao(user.id);
    expect((await confirmarEmailComToken(token)).estado).toBe("ok");
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).not.toBeNull();
    expect((await confirmarEmailComToken(token)).estado).toBe("usado");
  });

  it("expira em 24h", async () => {
    const user = await criarUsuario();
    const emitidoEm = new Date();
    const token = await emitirTokenConfirmacao(user.id, emitidoEm);
    const depois = new Date(emitidoEm.getTime() + 24 * 60 * 60_000);
    expect((await confirmarEmailComToken(token, depois)).estado).toBe("expirado");
  });
});

describe("rate limit no Postgres", () => {
  it("bloqueia após o máximo e libera na janela seguinte", async () => {
    const chave = `${prefixo}:login`;
    const limite = { max: 3, janelaMs: 60_000 };
    const t = Date.parse("2026-10-08T12:00:10Z");
    expect(await consumir(chave, limite, t)).toBe(true);
    expect(await consumir(chave, limite, t + 1000)).toBe(true);
    expect(await consumir(chave, limite, t + 2000)).toBe(true);
    expect(await consumir(chave, limite, t + 3000)).toBe(false);
    expect(await consumir(chave, limite, t + 60_000)).toBe(true);
    await limparLimite(chave);
    expect(await consumir(chave, limite, t + 4000)).toBe(true);
  });
});

describe("LGPD", () => {
  it("exportação não inclui hash de senha nem de tokens", async () => {
    const user = await criarUsuario();
    await criarSessoes(user.id, 1);
    await emitirTokenReset(user.id);
    const dados = await exportarDadosDoUsuario(user.id);
    const json = JSON.stringify(dados);
    expect(dados.usuario.email).toBe(user.email);
    expect(json).not.toContain(user.passwordHash);
    expect(json).not.toMatch(/tokenHash|passwordHash/);
    expect(dados.usuario.sessions).toHaveLength(1);
  });

  it("exclusão apaga o usuário e tira o IP dos logs de auditoria", async () => {
    const user = await criarUsuario();
    await criarSessoes(user.id, 2);
    await db.auditLog.create({ data: { action: "login", userId: user.id, ip: "203.0.113.9" } });

    await excluirDadosDoUsuario(user.id);

    expect(await db.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { ip: "203.0.113.9" } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "login", userId: null } })).toBeGreaterThan(0);
  });
});
