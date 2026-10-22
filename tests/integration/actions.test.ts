import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks do runtime do Next (cookies, headers, redirect, after) ───
const jar = new Map<string, string>();
let ipAtual = "198.51.100.1";
const tarefasDepois: Promise<unknown>[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => (jar.has(nome) ? { name: nome, value: jar.get(nome) } : undefined),
    set: (nome: string, valor: string) => void jar.set(nome, valor),
    delete: (nome: string) => void jar.delete(nome),
  }),
  headers: async () => new Headers({ "x-forwarded-for": ipAtual, "user-agent": "vitest" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/server", () => ({ after: (fn: () => Promise<unknown>) => void tarefasDepois.push(fn()) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { db } = await import("@/lib/db");
const actions = await import("@/lib/auth/actions");
const { outbox } = await import("@/lib/email/send");
const { SESSION_COOKIE } = await import("@/lib/auth/session");

const prefixo = randomUUID().slice(0, 6);
const emailsCriados: string[] = [];

function novoEmail() {
  const e = `act-${prefixo}-${randomUUID().slice(0, 6)}@exemplo.test`;
  emailsCriados.push(e);
  return e;
}

async function esperarRedirect(p: Promise<unknown>): Promise<string> {
  try {
    const r = await p;
    throw new Error(`Esperava redirect, veio ${JSON.stringify(r)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.startsWith("REDIRECT:")) throw e;
    return msg.slice("REDIRECT:".length);
  }
}

async function cadastrar(email: string, senha = "cavalo-azul-9") {
  const destino = await esperarRedirect(actions.cadastrar({ nome: "Ana Teste", email, senha, aceiteTermos: true }));
  return { destino };
}

beforeEach(() => {
  jar.clear();
  ipAtual = `198.51.100.${Math.floor(Math.random() * 250)}`;
});

afterAll(async () => {
  await Promise.allSettled(tarefasDepois);
  await db.user.deleteMany({ where: { email: { in: emailsCriados } } });
  await db.rateLimit.deleteMany({
    where: { OR: [{ key: { contains: prefixo } }, { key: { contains: ":198.51.100." } }] },
  });
  await db.$disconnect();
});

describe("cadastro", () => {
  it("cria usuário não confirmado, aceites 2026-10, preferências, sessão e e-mail de confirmação", async () => {
    const email = novoEmail();
    const { destino } = await cadastrar(email.toUpperCase());
    expect(destino).toBe("/hoje");
    await Promise.all(tarefasDepois);

    const user = await db.user.findUniqueOrThrow({
      where: { email },
      include: { consents: true, notificationPreference: true, sessions: true, emailVerificationTokens: true },
    });
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.consents.map((c) => `${c.kind}:${c.version}`).sort()).toEqual([
      "PRIVACIDADE:2026-10",
      "TERMOS:2026-10",
    ]);
    expect(user.notificationPreference).not.toBeNull();
    expect(user.sessions).toHaveLength(1);
    expect(user.emailVerificationTokens).toHaveLength(1);
    expect(jar.get(SESSION_COOKIE)).toBeTruthy();
    expect(outbox.some((m) => m.to === email && m.subject === "Confirme seu e-mail")).toBe(true);
  });

  it("recusa e-mail já usado com mensagem genérica", async () => {
    const email = novoEmail();
    await cadastrar(email);
    jar.clear();
    const r = await actions.cadastrar({
      nome: "Outra",
      email,
      senha: "cavalo-azul-9",
      aceiteTermos: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.email?.[0]).toMatch(/Não foi possível usar este e-mail/);
  });
});

describe("login", () => {
  it("entra com credenciais corretas e respeita o voltar interno", async () => {
    const email = novoEmail();
    await cadastrar(email);
    jar.clear();
    expect(await esperarRedirect(actions.entrar({ email, senha: "cavalo-azul-9", voltar: "/simulados" }))).toBe(
      "/simulados",
    );
    expect(jar.get(SESSION_COOKIE)).toBeTruthy();
    expect(await esperarRedirect(actions.entrar({ email, senha: "cavalo-azul-9", voltar: "//evil.com" }))).toBe(
      "/hoje",
    );
    const logs = await db.auditLog.count({ where: { action: "login", user: { email } } });
    expect(logs).toBe(2);
  });

  it("mensagem genérica igual para senha errada e e-mail inexistente", async () => {
    const email = novoEmail();
    await cadastrar(email);
    jar.clear();
    const errada = await actions.entrar({ email, senha: "senha-errada-1" });
    const inexistente = await actions.entrar({ email: `nao-existe-${prefixo}@exemplo.test`, senha: "senha-errada-1" });
    expect(errada).toEqual(inexistente);
    expect(errada.ok).toBe(false);
    if (!errada.ok) expect(errada.error).toBe("E-mail ou senha incorretos.");
  });

  it("bloqueia após 5 tentativas por e-mail em 15 minutos", async () => {
    const email = novoEmail();
    await cadastrar(email);
    jar.clear();
    for (let i = 0; i < 5; i++) {
      const r = await actions.entrar({ email, senha: `errada-${i}-xyz` });
      expect(r.ok === false && r.code).toBe("credenciais");
    }
    const bloqueado = await actions.entrar({ email, senha: "cavalo-azul-9" });
    expect(bloqueado.ok).toBe(false);
    if (!bloqueado.ok) {
      expect(bloqueado.code).toBe("rate_limit");
      expect(bloqueado.error).toMatch(/Aguarde alguns minutos/);
    }
  });
});

describe("esqueci e redefinir senha", () => {
  it("resposta igual para e-mail existente e inexistente; reset revoga sessões e avisa por e-mail", async () => {
    const email = novoEmail();
    await cadastrar(email);
    const user = await db.user.findUniqueOrThrow({ where: { email } });

    const existente = await actions.esqueciSenha({ email });
    const inexistente = await actions.esqueciSenha({ email: `nao-existe-${prefixo}@exemplo.test` });
    expect(existente).toEqual(inexistente);
    await Promise.all(tarefasDepois);

    const mensagem = outbox.findLast((m) => m.to === email && m.subject === "Redefinição de senha");
    expect(mensagem).toBeDefined();
    const props = mensagem?.react.props as { link: string };
    const token = new URL(props.link).searchParams.get("token") ?? "";

    expect(
      await esperarRedirect(
        actions.redefinirSenha({ token, senha: "nova-senha-forte-7", confirmacao: "nova-senha-forte-7" }),
      ),
    ).toBe("/entrar?redefinida=1");
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    await Promise.all(tarefasDepois);
    expect(outbox.some((m) => m.to === email && m.subject === "Sua senha foi alterada")).toBe(true);
    expect(await db.auditLog.count({ where: { userId: user.id, action: "senha.redefinida" } })).toBe(1);

    const reuso = await actions.redefinirSenha({
      token,
      senha: "outra-senha-forte-8",
      confirmacao: "outra-senha-forte-8",
    });
    expect(reuso.ok === false && reuso.code).toBe("token_usado");
  });

  it("limita 3 pedidos por hora por e-mail", async () => {
    const email = `limite-${prefixo}@exemplo.test`;
    for (let i = 0; i < 3; i++) expect((await actions.esqueciSenha({ email })).ok).toBe(true);
    const r = await actions.esqueciSenha({ email });
    expect(r.ok === false && r.code).toBe("rate_limit");
  });
});

describe("conta", () => {
  it("trocar senha mantém a sessão atual e revoga as outras", async () => {
    const email = novoEmail();
    await cadastrar(email);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await db.session.create({
      data: { userId: user.id, tokenHash: `outra-${randomUUID()}`, expiresAt: new Date(Date.now() + 86_400_000) },
    });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(2);

    const errada = await actions.trocarSenha({
      senhaAtual: "errada-123",
      novaSenha: "nova-senha-forte-7",
      confirmacao: "nova-senha-forte-7",
    });
    expect(errada.ok === false && errada.fieldErrors?.senhaAtual).toBeTruthy();

    const r = await actions.trocarSenha({
      senhaAtual: "cavalo-azul-9",
      novaSenha: "nova-senha-forte-7",
      confirmacao: "nova-senha-forte-7",
    });
    expect(r.ok).toBe(true);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { userId: user.id, action: "senha.trocada" } })).toBe(1);
  });

  it("excluir conta exige senha, apaga os dados e encerra a sessão", async () => {
    const email = novoEmail();
    await cadastrar(email);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const inicio = new Date();

    const errada = await actions.excluirConta({ senha: "errada-123", confirmacao: "EXCLUIR" });
    expect(errada.ok).toBe(false);
    expect(await db.user.count({ where: { id: user.id } })).toBe(1);

    expect(await esperarRedirect(actions.excluirConta({ senha: "cavalo-azul-9", confirmacao: "EXCLUIR" }))).toBe(
      "/?conta=excluida",
    );
    expect(await db.user.count({ where: { id: user.id } })).toBe(0);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(await db.consent.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.notificationPreference.count({ where: { userId: user.id } })).toBe(0);
    expect(
      await db.auditLog.count({ where: { action: "conta.excluida", userId: null, ip: null, createdAt: { gte: inicio } } }),
    ).toBeGreaterThan(0);
  });
});

describe("isolamento entre usuários (IDOR)", () => {
  it("as actions só alteram, exportam e excluem dados de quem está logado, mesmo com userId forjado", async () => {
    const emailA = novoEmail();
    await cadastrar(emailA);
    const a = await db.user.findUniqueOrThrow({ where: { email: emailA } });
    jar.clear();
    const emailB = novoEmail();
    await cadastrar(emailB);
    const b = await db.user.findUniqueOrThrow({ where: { email: emailB } });

    // Logado como B, tentando mirar A pelo corpo da requisição.
    const forjado = { userId: a.id, id: a.id } as Record<string, unknown>;
    expect((await actions.atualizarDados({ nome: "Invasora", ...forjado })).ok).toBe(true);
    expect(
      (
        await actions.atualizarPreferencias({
          revisoes: false,
          mudancaExame: false,
          recertificacao: false,
          avisosPagamento: false,
          ...forjado,
        })
      ).ok,
    ).toBe(true);

    expect((await db.user.findUniqueOrThrow({ where: { id: a.id } })).name).toBe("Ana Teste");
    expect((await db.user.findUniqueOrThrow({ where: { id: b.id } })).name).toBe("Invasora");
    expect(await db.notificationPreference.findUniqueOrThrow({ where: { userId: a.id } })).toMatchObject({
      revisoes: true,
      mudancaExame: true,
      recertificacao: true,
      avisosPagamento: true,
    });

    const { exportarDadosDoUsuario } = await import("@/lib/auth/fluxos");
    const exportB = JSON.stringify(await exportarDadosDoUsuario(b.id));
    expect(exportB).toContain(emailB);
    expect(exportB).not.toContain(emailA);
    expect(exportB).not.toContain(a.id);

    await esperarRedirect(actions.excluirConta({ senha: "cavalo-azul-9", confirmacao: "EXCLUIR", ...forjado }));
    expect(await db.user.count({ where: { id: b.id } })).toBe(0);
    expect(await db.user.count({ where: { id: a.id } })).toBe(1);
    expect(await db.session.count({ where: { userId: a.id } })).toBe(1);
  });

  it("sem sessão, as actions de conta mandam para /entrar", async () => {
    jar.clear();
    expect(await esperarRedirect(actions.atualizarDados({ nome: "Ninguém" }))).toBe("/entrar");
    expect(await esperarRedirect(actions.excluirConta({ senha: "x", confirmacao: "EXCLUIR" }))).toBe("/entrar");
  });
});
