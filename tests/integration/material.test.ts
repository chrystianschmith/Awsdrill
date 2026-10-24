import type Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { gerarEGravarMaterial, type DepsMaterial } from "@/lib/ai/material";
import { fonteOrcamentoPrisma, OrcamentoEsgotadoError, verificarOrcamento } from "@/lib/ai/orcamento";
import { ValidacaoIAError } from "@/lib/ai/gerar-validado";
import { registrarUsoIA } from "@/lib/ai/registro";
import { gerarMaterial, LIMITE_REPORTS_ABERTOS, lerMaterial, reportarErro } from "@/lib/ai/servico-material";
import { aplicarExame } from "@/lib/catalogo/publicacao";
import type { ExameColetado } from "@/lib/catalogo/schemas";
import { seguirExame } from "@/lib/estudo/servico-exames";
import { EXAMES_INICIAIS } from "../../prisma/catalogo/exames";
import { materialFicticio } from "../apoio/questoes";

const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
const usuarios: string[] = [];
let exame: { id: string; codigo: string; slug: string };
let tarefas: { id: string; code: string }[];

function resposta(texto: string): Anthropic.Message {
  return {
    id: "msg_teste",
    type: "message",
    role: "assistant",
    model: "gemini-3.5-flash-lite",
    content: [{ type: "text", text: texto, citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as unknown as Anthropic.Message;
}

/** IA mockada que demora `ms` e devolve o material válido da tarefa. */
function deps(
  codigo: string,
  o: { ms?: number; texto?: string } = {},
): DepsMaterial & { chamar: ReturnType<typeof vi.fn> } {
  const chamar = vi.fn(async () => {
    await new Promise((r) => setTimeout(r, o.ms ?? 0));
    return resposta(o.texto ?? JSON.stringify(materialFicticio(codigo, sufixo)));
  });
  return {
    db,
    chamar,
    verificarOrcamento: async () => undefined,
    aoUsar: async ({ model, usage }) => {
      await registrarUsoIA(db, { purpose: "material", model, usage, promptVersion: "teste" });
    },
    modelos: { principal: "gemini-3.5-flash-lite", reserva: "gemini-3.5-flash-lite" },
  };
}

async function criarUsuario(seguir = true): Promise<string> {
  const u = await db.user.create({
    data: { name: "Material Teste", email: `mat-${randomUUID()}@exemplo.test`, passwordHash: "x" },
    select: { id: true },
  });
  usuarios.push(u.id);
  if (seguir) await seguirExame(u.id, exame.id);
  return u.id;
}

beforeAll(async () => {
  const e = structuredClone(EXAMES_INICIAIS[0]) as ExameColetado;
  e.codigo = `MAT-${sufixo}`;
  e.certificacao = { ...e.certificacao, slug: `mat-${sufixo.toLowerCase()}` };
  await aplicarExame(db, e);
  const v = await db.examVersion.findUniqueOrThrow({ where: { code: e.codigo }, select: { id: true } });
  exame = { id: v.id, codigo: e.codigo, slug: e.certificacao.slug };
  tarefas = await db.domain.findMany({
    where: { examVersionId: v.id, parentId: { not: null } },
    orderBy: [{ code: "asc" }],
    select: { id: true, code: true },
  });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: usuarios } } });
  await db.aiUsageLog.deleteMany({ where: { promptVersion: "teste" } });
  await db.question.deleteMany({ where: { examVersionId: exame.id } });
  await db.examVersion.deleteMany({ where: { id: exame.id } });
  await db.certification.deleteMany({ where: { slug: exame.slug } });
  await db.$disconnect();
});

describe("geração do material", () => {
  it("duas requisições simultâneas geram uma vez só; questões entram pendentes", async () => {
    const t = tarefas[0]!;
    const a = deps(t.code, { ms: 400 });
    const b = deps(t.code, { ms: 400 });
    const [ra, rb] = await Promise.all([gerarEGravarMaterial(a, t.id), gerarEGravarMaterial(b, t.id)]);
    expect([ra.status, rb.status].sort()).toEqual(["ocupado", "pronto"]);
    expect(a.chamar.mock.calls.length + b.chamar.mock.calls.length).toBe(1);

    expect(await db.summary.count({ where: { topicId: t.id } })).toBe(1);
    expect(await db.flashcard.count({ where: { topicId: t.id } })).toBe(5);
    const questoes = await db.question.findMany({
      where: { topicId: t.id },
      select: { publishState: true, origin: true },
    });
    expect(questoes).toHaveLength(5);
    expect(questoes.every((q) => q.publishState === "PENDING_REVIEW" && q.origin === "ia")).toBe(true);

    // Já gerado: não chama a IA de novo.
    const c = deps(t.code);
    expect((await gerarEGravarMaterial(c, t.id)).status).toBe("pronto");
    expect(c.chamar).not.toHaveBeenCalled();
  });

  it("teto atingido pausa antes de chamar a IA", async () => {
    const t = tarefas[1]!;
    const d = deps(t.code);
    d.verificarOrcamento = async () => {
      await verificarOrcamento({ fonte: fonteOrcamentoPrisma(db), limiteUsd: 0, emailAlerta: null });
    };
    await expect(gerarEGravarMaterial(d, t.id)).rejects.toBeInstanceOf(OrcamentoEsgotadoError);
    expect(d.chamar).not.toHaveBeenCalled();
    expect(await db.summary.count({ where: { topicId: t.id } })).toBe(0);
  });

  it("saída inválida não grava nada, mas o custo das tentativas fica registrado", async () => {
    const t = tarefas[2]!;
    const antes = await db.aiUsageLog.count({ where: { promptVersion: "teste" } });
    const d = deps(t.code, { texto: '{"resumo":{"texto":"<script>"}}' });
    await expect(gerarEGravarMaterial(d, t.id)).rejects.toBeInstanceOf(ValidacaoIAError);
    expect(d.chamar).toHaveBeenCalledTimes(3);
    expect(await db.aiUsageLog.count({ where: { promptVersion: "teste" } })).toBe(antes + 3);
    expect(await db.summary.count({ where: { topicId: t.id } })).toBe(0);
    expect(await db.question.count({ where: { topicId: t.id } })).toBe(0);
  });
});

describe("material no app", () => {
  it("sem chave de IA a geração fica desligada; quem não segue o exame é recusado", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const u = await criarUsuario();
    expect(await gerarMaterial(u, tarefas[3]!.id)).toMatchObject({ status: "indisponivel", motivo: "ia-desligada" });
    const estranho = await criarUsuario(false);
    await expect(gerarMaterial(estranho, tarefas[3]!.id)).rejects.toThrow("Tarefa não encontrada.");
    vi.unstubAllEnvs();
  });

  it("reportar erro: só quem segue, só conteúdo da tarefa; acima do limite despublica", async () => {
    const t = tarefas[0]!;
    const m = (await lerMaterial(t.id))!;
    expect(m.geradoPorIA).toBe(true);
    const outraTarefa = { topicId: tarefas[1]!.id, contentType: "summary" as const, contentId: m.resumo.id };

    const estranho = await criarUsuario(false);
    const base = { topicId: t.id, contentType: "summary" as const, contentId: m.resumo.id, message: "Fonte errada." };
    await expect(reportarErro(estranho, base)).rejects.toThrow("Tarefa não encontrada.");
    const u = await criarUsuario();
    await expect(reportarErro(u, { ...outraTarefa, message: "Fonte errada." })).rejects.toThrow(
      "Conteúdo não encontrado.",
    );
    await expect(reportarErro(u, { ...base, message: "x" })).rejects.toThrow();

    for (let i = 0; i < LIMITE_REPORTS_ABERTOS; i++) {
      expect(await reportarErro(u, { ...base, contentType: "flashcard", contentId: m.flashcards[i]!.id })).toEqual({
        despublicado: false,
      });
    }
    expect(await reportarErro(u, base)).toEqual({ despublicado: true });
    expect(await lerMaterial(t.id)).toBeNull();
    expect(await db.contentReport.count({ where: { topicId: t.id, resolvedAt: null } })).toBe(
      LIMITE_REPORTS_ABERTOS + 1,
    );

    // Despublicado: a próxima geração refaz o material (e conta reports só da versão nova).
    expect((await gerarEGravarMaterial(deps(t.code), t.id)).status).toBe("pronto");
    const novo = (await lerMaterial(t.id))!;
    expect(novo.flashcards).toHaveLength(5);
    expect(await reportarErro(u, { ...base, contentId: novo.resumo.id })).toEqual({ despublicado: false });
  });
});
