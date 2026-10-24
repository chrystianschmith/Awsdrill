import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { certificacaoPorSlug } from "@/lib/catalogo/consultas";
import { exameGravado } from "@/lib/catalogo/gravado";
import { aprovarRevisao, rejeitarRevisao } from "@/lib/catalogo/moderacao";
import { executarPipeline } from "@/lib/catalogo/pipeline";
import { aplicarExame } from "@/lib/catalogo/publicacao";
import type { ExameColetado } from "@/lib/catalogo/schemas";
import { EXAMES_INICIAIS } from "../../prisma/catalogo/exames";
import { buscarEm, guiaEmMarkdown } from "../apoio/guia-markdown";

const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
const slugs: string[] = [];
const codigos: string[] = [];
const runs: string[] = [];

async function exameNoBanco(letra: string): Promise<ExameColetado> {
  const e = structuredClone(EXAMES_INICIAIS[0]) as ExameColetado;
  e.codigo = `PIP${letra}-${sufixo}`;
  e.certificacao = { ...e.certificacao, slug: `pipeline-${letra.toLowerCase()}-${sufixo.toLowerCase()}` };
  slugs.push(e.certificacao.slug);
  codigos.push(e.codigo);
  await aplicarExame(db, e);
  return e;
}

async function rodar(exame: ExameColetado, guia: ExameColetado, hoje = "2026-11-01") {
  const r = await executarPipeline(db, { buscar: buscarEm(guiaEmMarkdown(guia)), hoje, codigos: [exame.codigo] });
  if (r.runId) runs.push(r.runId);
  return r;
}

afterAll(async () => {
  await db.catalogReview.deleteMany({ where: { examCode: { in: codigos } } });
  await db.catalogRun.deleteMany({ where: { id: { in: runs } } });
  await db.examVersion.deleteMany({ where: { certification: { slug: { in: slugs } } } });
  await db.certification.deleteMany({ where: { slug: { in: slugs } } });
  await db.$disconnect();
});

describe("executarPipeline", () => {
  it("guia igual: só atualiza a data de leitura e registra a execução", async () => {
    const e = await exameNoBanco("A");
    const r = await rodar(e, e);
    expect(r).toMatchObject({ verificados: 1, semMudanca: 1, publicados: 0, moderacao: 0, erros: [] });

    const v = await db.examVersion.findUniqueOrThrow({ where: { code: e.codigo }, select: { retrievedAt: true } });
    expect(v.retrievedAt.toISOString().slice(0, 10)).toBe("2026-11-01");
    const run = await db.catalogRun.findUniqueOrThrow({ where: { id: r.runId! } });
    expect(run).toMatchObject({ status: "SUCCEEDED", examsChecked: 1, examsUnchanged: 1 });
    expect(await db.blueprintWeight.count({ where: { domain: { examVersion: { code: e.codigo } }, revision: 2 } })).toBe(0);
  });

  it("mudança coerente de peso e tarefa publica sozinha uma revisão nova e retira a tarefa que saiu", async () => {
    const e = await exameNoBanco("B");
    const novo = structuredClone(e);
    novo.dominios[0]!.peso = 22;
    novo.dominios[1]!.peso = 32;
    novo.dominios[0]!.tarefas.pop(); // 1.4 sai do guia
    const r = await rodar(e, novo);
    expect(r).toMatchObject({ publicados: 1, moderacao: 0 });

    const gravado = await exameGravado(db, e.codigo);
    expect(gravado!.dominios.map((d) => d.peso)).toEqual([22, 32, 34, 12]);
    expect(gravado!.dominios[0]!.tarefas.map((t) => t.codigo)).toEqual(["1.1", "1.2", "1.3"]);
    const retirada = await db.domain.findFirstOrThrow({ where: { examVersion: { code: e.codigo }, code: "1.4" } });
    expect(retirada.retiredAt).not.toBeNull();

    const pagina = await certificacaoPorSlug(e.certificacao.slug);
    expect(pagina?.revisao).toBe(2);
    expect(pagina?.dominios[0]!.tarefas).toHaveLength(3);
  });

  it("mudança incoerente vai para a fila sem tocar o catálogo; a mesma coleta não entra duas vezes", async () => {
    const e = await exameNoBanco("C");
    const ruim = structuredClone(e);
    ruim.dominios[0]!.peso = 50; // soma 126%
    const r1 = await rodar(e, ruim);
    expect(r1).toMatchObject({ publicados: 0, moderacao: 1 });
    await rodar(e, ruim, "2026-12-01");

    const fila = await db.catalogReview.findMany({ where: { examCode: e.codigo } });
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ status: "PENDING", runId: r1.runId });
    expect(fila[0]!.confidence.toNumber()).toBeLessThan(0.85);
    expect(fila[0]!.problems).toContain("Pesos somam 126%, não 100%.");

    expect((await exameGravado(db, e.codigo))!.dominios[0]!.peso).toBe(24);
  });

  it("aprovar aplica a coleta; rejeitar mantém o catálogo e impede a volta da mesma coleta", async () => {
    const e = await exameNoBanco("D");
    const semDominio = structuredClone(e);
    semDominio.dominios.pop(); // remoção de domínio sempre passa por gente
    semDominio.dominios[0]!.peso = 36;
    await rodar(e, semDominio);
    const pendente = await db.catalogReview.findFirstOrThrow({ where: { examCode: e.codigo, status: "PENDING" } });

    expect((await aprovarRevisao(db, pendente.id)).revisao).toBe(2);
    expect((await exameGravado(db, e.codigo))!.dominios.map((d) => d.codigo)).toEqual(["1", "2", "3"]);
    await expect(aprovarRevisao(db, pendente.id)).rejects.toThrow(/APPROVED/);

    const outra = structuredClone(semDominio);
    outra.dominios[0]!.peso = 50;
    await rodar(e, outra);
    const segunda = await db.catalogReview.findFirstOrThrow({ where: { examCode: e.codigo, status: "PENDING" } });
    await rejeitarRevisao(db, segunda.id);
    expect((await exameGravado(db, e.codigo))!.dominios[0]!.peso).toBe(36);
    await rodar(e, outra, "2027-01-01");
    expect(await db.catalogReview.count({ where: { examCode: e.codigo, status: "PENDING" } })).toBe(0);
  });

  it("coleta nova do mesmo exame substitui a pendente", async () => {
    const e = await exameNoBanco("E");
    const a = structuredClone(e);
    a.dominios[0]!.peso = 50;
    const b = structuredClone(e);
    b.dominios[0]!.peso = 60;
    await rodar(e, a);
    await rodar(e, b);
    const fila = await db.catalogReview.findMany({ where: { examCode: e.codigo }, orderBy: { createdAt: "asc" } });
    expect(fila.map((f) => f.status)).toEqual(["SUPERSEDED", "PENDING"]);
  });

  it("erro em um exame não para a execução e fica registrado", async () => {
    const e = await exameNoBanco("F");
    const r = await executarPipeline(db, { buscar: buscarEm(new Map()), hoje: "2026-11-01", codigos: [e.codigo, "NAO-EXISTE"] });
    runs.push(r.runId!);
    expect(r.erros.map((x) => x.codigo)).toEqual([e.codigo, "NAO-EXISTE"]);
    expect((await db.catalogRun.findUniqueOrThrow({ where: { id: r.runId! } })).status).toBe("FAILED");
  });

  it("dry-run não grava nada", async () => {
    const e = await exameNoBanco("G");
    const novo = structuredClone(e);
    novo.dominios[0]!.peso = 22;
    novo.dominios[1]!.peso = 32;
    const r = await executarPipeline(db, { buscar: buscarEm(guiaEmMarkdown(novo)), hoje: "2026-11-01", codigos: [e.codigo], dryRun: true });
    expect(r).toMatchObject({ runId: null, publicados: 1 });
    expect((await exameGravado(db, e.codigo))!.dominios[0]!.peso).toBe(24);
  });
});
