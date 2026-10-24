import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/* Toda ação do admin revalida o papel no servidor: usuário comum recebe 404, sem sessão vai ao login. */

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => (jar.has(nome) ? { name: nome, value: jar.get(nome) } : undefined),
    set: (nome: string, valor: string) => void jar.set(nome, valor),
    delete: (nome: string) => void jar.delete(nome),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.9", "user-agent": "vitest" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  unstable_rethrow: (e: unknown) => {
    if (e instanceof Error && /^(REDIRECT|NOT_FOUND)/.test(e.message)) throw e;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { db } = await import("@/lib/db");
const { SESSION_COOKIE } = await import("@/lib/auth/session");
const { gerarToken, hashToken } = await import("@/lib/auth/tokens");
const admin = await import("@/lib/admin/actions");
const { aplicarExame } = await import("@/lib/catalogo/publicacao");
const { importarQuestoes } = await import("@/lib/simulados/importacao");
const { EXAMES_INICIAIS } = await import("../../prisma/catalogo/exames");
const { arquivoFicticio } = await import("../apoio/questoes");

const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
const codigo = `ADM-${sufixo}`;
const slug = `admin-${sufixo.toLowerCase()}`;
const usuarios: string[] = [];
let tokenComum: string;
let tokenAdmin: string;
let questoes: string[];
let topicId: string;
let reportId: string;

async function criarConta(role: "USER" | "ADMIN") {
  const u = await db.user.create({
    data: { name: `Admin ${role}`, email: `adm-${randomUUID()}@exemplo.test`, passwordHash: "x", role },
    select: { id: true },
  });
  usuarios.push(u.id);
  const token = gerarToken();
  await db.session.create({
    data: { userId: u.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60_000) },
  });
  return { id: u.id, token };
}

const como = (token: string | null) => (token ? jar.set(SESSION_COOKIE, token) : jar.delete(SESSION_COOKIE));

beforeAll(async () => {
  const e = structuredClone(EXAMES_INICIAIS[0]!);
  e.codigo = codigo;
  e.certificacao = { ...e.certificacao, slug };
  await aplicarExame(db, e);
  await importarQuestoes(db, arquivoFicticio(codigo, ["1.1"], 3));
  questoes = (await db.question.findMany({ where: { examVersion: { code: codigo } }, select: { id: true } })).map(
    (q) => q.id,
  );
  topicId = (await db.domain.findFirstOrThrow({ where: { examVersion: { code: codigo }, code: "1.1" } })).id;
  reportId = (
    await db.contentReport.create({
      data: { topicId, contentType: "summary", contentId: "x", message: "Fonte errada." },
      select: { id: true },
    })
  ).id;
  tokenComum = (await criarConta("USER")).token;
  tokenAdmin = (await criarConta("ADMIN")).token;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { userId: { in: usuarios } } });
  await db.user.deleteMany({ where: { id: { in: usuarios } } });
  await db.contentReport.deleteMany({ where: { topicId } });
  await db.question.deleteMany({ where: { examVersion: { code: codigo } } });
  await db.examVersion.deleteMany({ where: { certification: { slug } } });
  await db.certification.deleteMany({ where: { slug } });
  await db.$disconnect();
});

const chamadas = () => [
  () => admin.moderarQuestoesAction({ ids: questoes, aprovar: true }),
  () => admin.resolverReportAction(reportId),
  () => admin.decidirMaterialAction({ topicId, decisao: "regerar" }),
  () => admin.decidirRevisaoCatalogoAction({ id: "qualquer", aprovar: true }),
];

describe("ações do admin", () => {
  it("usuário comum recebe 404 e nada muda; sem sessão vai para o login", async () => {
    como(tokenComum);
    for (const c of chamadas()) await expect(c()).rejects.toThrow("NOT_FOUND");
    como(null);
    for (const c of chamadas()) await expect(c()).rejects.toThrow("REDIRECT:/entrar");
    expect(await db.question.count({ where: { id: { in: questoes }, publishState: "PENDING_REVIEW" } })).toBe(3);
    expect((await db.contentReport.findUniqueOrThrow({ where: { id: reportId } })).resolvedAt).toBeNull();
  });

  it("admin rejeita com motivo, aprova o resto e a decisão fica na auditoria", async () => {
    como(tokenAdmin);
    const semMotivo = await admin.moderarQuestoesAction({ ids: [questoes[0]!], aprovar: false, nota: "" });
    expect(semMotivo.ok).toBe(false);
    const rejeitada = await admin.moderarQuestoesAction({
      ids: [questoes[0]!],
      aprovar: false,
      nota: "Gabarito errado.",
    });
    expect(rejeitada).toEqual({ ok: true, data: { moderadas: 1 } });
    // Já moderada não muda de novo: só as 2 pendentes são aprovadas.
    expect(await admin.moderarQuestoesAction({ ids: questoes, aprovar: true })).toEqual({
      ok: true,
      data: { moderadas: 2 },
    });
    const estados = await db.question.findMany({ where: { id: { in: questoes } }, select: { publishState: true } });
    expect(estados.map((e) => e.publishState).sort()).toEqual(["PUBLISHED", "PUBLISHED", "REJECTED"]);
    expect(await admin.resolverReportAction(reportId)).toEqual({ ok: true });
    expect((await admin.resolverReportAction(reportId)).ok).toBe(false);
    const auditoria = await db.auditLog.findMany({ where: { userId: { in: usuarios } }, select: { action: true } });
    expect(auditoria.map((a) => a.action).sort()).toEqual([
      "admin.questoes.aprovadas",
      "admin.questoes.rejeitadas",
      "admin.report.resolvido",
    ]);
  });

  it("revisão do catálogo inexistente é recusada com mensagem", async () => {
    como(tokenAdmin);
    expect(await admin.decidirRevisaoCatalogoAction({ id: "nao-existe", aprovar: false })).toMatchObject({
      ok: false,
      error: "Revisão não encontrada.",
    });
  });
});
