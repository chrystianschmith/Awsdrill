import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lerGuiaPrincipal, lerPaginaDominio, montarColetado, urlMarkdown, type PaginaDominio } from "@/lib/catalogo/guia";
import type { ExameColetado } from "@/lib/catalogo/schemas";
import { EXAMES_INICIAIS } from "../../../prisma/catalogo/exames";

const fixture = (nome: string) => readFileSync(path.join(__dirname, "../../fixtures/exam-guides", nome), "utf8");
const SAA = EXAMES_INICIAIS.find((e) => e.codigo === "SAA-C03") as ExameColetado;
const URL_SAA = urlMarkdown(SAA.fonteGuia);

describe("urlMarkdown", () => {
  it("troca .html por .md e tira âncora e query", () => {
    expect(urlMarkdown("https://docs.aws.amazon.com/a/b/guia.html?x=1#y")).toBe("https://docs.aws.amazon.com/a/b/guia.md");
  });
  it("recusa URL que não é página", () => {
    expect(() => urlMarkdown("https://docs.aws.amazon.com/a/b/")).toThrow();
  });
});

describe("lerGuiaPrincipal (fixture SAA-C03)", () => {
  const guia = lerGuiaPrincipal(fixture("saa-c03.md"), URL_SAA);

  it("lê código, questões e nota de corte", () => {
    expect(guia).toMatchObject({ codigo: "SAA-C03", questoesPontuadas: 50, questoesNaoPontuadas: 15, notaCorte: 720 });
  });

  it("lê o sumário de domínios com peso e link absoluto, igual ao seed", () => {
    expect(guia.dominios.map((d) => [d.codigo, d.nomeEn, d.peso])).toEqual(SAA.dominios.map((d) => [d.codigo, d.nomeEn, d.peso]));
    expect(guia.dominios[0]!.url).toBe(
      "https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain1.md",
    );
  });

  it("ignora link de domínio que sai do host oficial", () => {
    const md = "+ [Content Domain 1: X (100% of scored content)](https://evil.example/d1.md)";
    expect(lerGuiaPrincipal(md, URL_SAA).dominios).toEqual([]);
  });

  it("devolve null no que não encontra", () => {
    expect(lerGuiaPrincipal("# Página qualquer", URL_SAA)).toEqual({
      codigo: null,
      questoesPontuadas: null,
      questoesNaoPontuadas: null,
      notaCorte: null,
      dominios: [],
    });
  });
});

describe("lerPaginaDominio", () => {
  it('lê o formato "Task 1.1:" (SAA) igual ao seed', () => {
    const p = lerPaginaDominio(fixture("saa-c03-domain1.md"));
    expect(p.codigo).toBe("1");
    expect(p.nomeEn).toBe("Design Secure Architectures");
    expect(p.peso).toBeNull();
    expect(p.tarefas).toEqual(SAA.dominios[0]!.tarefas.map(({ codigo, nomeEn }) => ({ codigo, nomeEn })));
  });

  it('lê o formato "Task Statement 3.1:" com ponto final e o peso repetido na página (CLF)', () => {
    const p = lerPaginaDominio(fixture("clf-c02-domain3.md"));
    expect(p).toMatchObject({ codigo: "3", nomeEn: "Cloud Technology and Services", peso: 34 });
    expect(p.tarefas.map((t) => t.codigo)).toEqual(["3.1", "3.2", "3.7"]);
    expect(p.tarefas[0]!.nomeEn).toBe("Define methods of deploying and operating in the AWS Cloud.");
  });
});

describe("montarColetado", () => {
  const guia = lerGuiaPrincipal(fixture("saa-c03.md"), URL_SAA);
  const paginasDoSeed = new Map<string, PaginaDominio>(
    SAA.dominios.map((d) => [
      d.codigo,
      { codigo: d.codigo, nomeEn: d.nomeEn, peso: null, tarefas: d.tarefas.map(({ codigo, nomeEn }) => ({ codigo, nomeEn })) },
    ]),
  );

  it("guia igual ao seed dá o mesmo exame, com a tradução mantida e a nova data de leitura", () => {
    const { exame, problemas } = montarColetado(SAA, guia, paginasDoSeed, "2026-11-01");
    expect(problemas).toEqual([]);
    expect(exame).toEqual({ ...SAA, lidoEm: "2026-11-01" });
  });

  it("perde a tradução só do que mudou de nome", () => {
    const paginas = new Map(paginasDoSeed);
    const d1 = paginas.get("1")!;
    paginas.set("1", { ...d1, tarefas: [{ codigo: "1.1", nomeEn: "Novo nome oficial" }, ...d1.tarefas.slice(1)] });
    const { exame } = montarColetado(SAA, guia, paginas, "2026-11-01");
    expect(exame.dominios[0]!.tarefas[0]!.nomePt).toBeNull();
    expect(exame.dominios[0]!.tarefas[1]!.nomePt).toBe(SAA.dominios[0]!.tarefas[1]!.nomePt);
  });

  it("aponta página ausente, código trocado e peso divergente", () => {
    const paginas = new Map(paginasDoSeed);
    paginas.delete("4");
    paginas.set("2", { ...paginas.get("2")!, peso: 99 });
    const { problemas } = montarColetado({ ...SAA, codigo: "SAA-C04" }, guia, paginas, "2026-11-01");
    expect(problemas).toEqual([
      "O guia diz SAA-C03, esperado SAA-C04.",
      "Peso do domínio 2 difere entre sumário (26%) e página (99%).",
      "Página do domínio 4 não lida.",
    ]);
  });
});
