import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { certificacaoPorSlug, listarCertificacoes } from "@/lib/catalogo/consultas";
import { aplicarExame } from "@/lib/catalogo/publicacao";
import type { ExameColetado } from "@/lib/catalogo/schemas";
import { EXAMES_INICIAIS } from "../../prisma/catalogo/exames";

const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
const slugs: string[] = [];

function exameDeTeste(letra: string): ExameColetado {
  const e = structuredClone(EXAMES_INICIAIS[0]) as ExameColetado;
  e.codigo = `TST${letra}-${sufixo}`;
  e.certificacao = { ...e.certificacao, slug: `teste-${letra.toLowerCase()}-${sufixo.toLowerCase()}` };
  slugs.push(e.certificacao.slug);
  return e;
}

afterAll(async () => {
  await db.examVersion.deleteMany({ where: { certification: { slug: { in: slugs } } } });
  await db.certification.deleteMany({ where: { slug: { in: slugs } } });
  await db.$disconnect();
});

describe("aplicarExame", () => {
  it("é idempotente e só cria revisão de pesos quando o blueprint muda", async () => {
    const e = exameDeTeste("A");
    expect(await aplicarExame(db, e)).toMatchObject({ revisao: 1, dataStatus: "OFFICIAL", publishState: "PUBLISHED" });
    expect((await aplicarExame(db, e)).revisao).toBeNull();

    const versao = await db.examVersion.findUniqueOrThrow({
      where: { code: e.codigo },
      select: { id: true, priceUsd: true, domains: { select: { code: true, parentId: true } } },
    });
    expect(versao.priceUsd?.toNumber()).toBe(100);
    expect(versao.domains).toHaveLength(23);
    expect(versao.domains.filter((d) => d.parentId === null)).toHaveLength(4);

    const mudado = structuredClone(e);
    const [d1, d2] = mudado.dominios;
    if (d1 && d2) {
      d1.peso = 26;
      d2.peso = 28;
    }
    expect((await aplicarExame(db, mudado)).revisao).toBe(2);

    const pesos = await db.blueprintWeight.findMany({
      where: { domain: { examVersionId: versao.id, code: "1" } },
      orderBy: { revision: "asc" },
      select: { revision: true, weightPct: true, sourceUrl: true },
    });
    expect(pesos.map((p) => [p.revision, p.weightPct?.toNumber()])).toEqual([
      [1, 24],
      [2, 26],
    ]);
    expect(pesos.every((p) => p.sourceUrl === e.fonteGuia)).toBe(true);

    // O site mostra a revisão mais nova.
    const detalhe = await certificacaoPorSlug(e.certificacao.slug);
    expect(detalhe?.revisao).toBe(2);
    expect(detalhe?.dominios.map((d) => d.peso)).toEqual([26, 28, 34, 12]);
    expect(detalhe?.dominios[0]?.tarefas.map((t) => t.codigo)).toEqual(["1.1", "1.2", "1.3", "1.4"]);
  });

  it("dado faltando fica a confirmar, vai para revisão e não aparece no site", async () => {
    const e = exameDeTeste("B");
    e.precoUsd = null;
    const dom = e.dominios[2];
    if (dom) dom.peso = null;
    expect(await aplicarExame(db, e)).toMatchObject({ dataStatus: "A_CONFIRMAR", publishState: "PENDING_REVIEW" });
    const peso = await db.blueprintWeight.findFirstOrThrow({
      where: { domain: { examVersion: { code: e.codigo }, code: "3" } },
      select: { weightPct: true, dataStatus: true },
    });
    expect(peso).toEqual({ weightPct: null, dataStatus: "A_CONFIRMAR" });
    expect((await listarCertificacoes()).some((c) => c.slug === e.certificacao.slug)).toBe(false);
    expect(await certificacaoPorSlug(e.certificacao.slug)).toBeNull();
  });

  it("recusa entrada fora do schema sem gravar nada", async () => {
    const e = exameDeTeste("C");
    await expect(aplicarExame(db, { ...e, fonteGuia: "https://exemplo.com" })).rejects.toThrow();
    expect(await db.examVersion.count({ where: { code: e.codigo } })).toBe(0);
  });
});
