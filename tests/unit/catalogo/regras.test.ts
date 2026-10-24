import { describe, expect, it } from "vitest";
import { EXAMES_INICIAIS } from "../../../prisma/catalogo/exames";
import {
  camposAConfirmar,
  conjuntoGoldenJacket,
  estadoDePublicacao,
  hashBlueprint,
  ordenarTrilha,
  problemasDoBlueprint,
  proximaRevisao,
  statusDosDados,
  versaoVigente,
} from "@/lib/catalogo/regras";
import { ExameColetado, type DominioColetado } from "@/lib/catalogo/schemas";

const base = ExameColetado.parse(EXAMES_INICIAIS[0]);
const copia = (): ExameColetado => structuredClone(base);

describe("blueprint", () => {
  it("dados iniciais são válidos, oficiais e com pesos somando 100%", () => {
    for (const exame of EXAMES_INICIAIS) {
      const e = ExameColetado.parse(exame);
      expect(problemasDoBlueprint(e.dominios), e.codigo).toEqual([]);
      expect(statusDosDados(e), e.codigo).toBe("OFFICIAL");
      expect(estadoDePublicacao(e), e.codigo).toBe("PUBLISHED");
      expect(e.dominios.reduce((s, d) => s + (d.peso ?? 0), 0), e.codigo).toBe(100);
    }
  });

  it("acusa soma de pesos incoerente", () => {
    const e = copia();
    (e.dominios[0] as DominioColetado).peso = 25;
    expect(problemasDoBlueprint(e.dominios)).toEqual(["Pesos somam 101%, não 100%."]);
    expect(estadoDePublicacao(e)).toBe("PENDING_REVIEW");
  });

  it("acusa domínio sem tarefas e numeração fora de ordem", () => {
    const e = copia();
    const d = e.dominios[1] as DominioColetado;
    d.tarefas = [];
    const t = (e.dominios[0] as DominioColetado).tarefas[1];
    if (t) t.codigo = "1.5";
    expect(problemasDoBlueprint(e.dominios)).toEqual([
      "Tarefa 1.5 fora de ordem (esperado 1.2).",
      "Domínio 2 sem task statements.",
    ]);
  });

  it("peso ausente não entra na soma, vira 'a confirmar' e manda para revisão", () => {
    const e = copia();
    (e.dominios[3] as DominioColetado).peso = null;
    e.duracaoMin = null;
    expect(problemasDoBlueprint(e.dominios)).toEqual([]);
    expect(camposAConfirmar(e)).toEqual(["duração", "peso do domínio 4"]);
    expect(statusDosDados(e)).toBe("A_CONFIRMAR");
    expect(estadoDePublicacao(e)).toBe("PENDING_REVIEW");
  });
});

describe("revisões de pesos", () => {
  it("hash ignora a tradução e espaços, mas muda com peso ou nome oficial", () => {
    const h = hashBlueprint(base.dominios);
    const traduzido = copia();
    (traduzido.dominios[0] as DominioColetado).nomePt = "Outra tradução";
    (traduzido.dominios[0] as DominioColetado).nomeEn = "  Cloud   Concepts ";
    expect(hashBlueprint(traduzido.dominios)).toBe(h);

    const peso = copia();
    (peso.dominios[0] as DominioColetado).peso = 23;
    expect(hashBlueprint(peso.dominios)).not.toBe(h);

    const nome = copia();
    const tarefa = (nome.dominios[0] as DominioColetado).tarefas[0];
    if (tarefa) tarefa.nomeEn = "Define the benefits of the cloud.";
    expect(hashBlueprint(nome.dominios)).not.toBe(h);
  });

  it("primeira coleta é a revisão 1; igual não cria revisão; diferente incrementa", () => {
    expect(proximaRevisao(null, "a")).toBe(1);
    expect(proximaRevisao({ revision: 1, sourceHash: "a" }, "a")).toBeNull();
    expect(proximaRevisao({ revision: 3, sourceHash: "a" }, "b")).toBe(4);
  });
});

describe("Golden Jacket e trilha", () => {
  const agora = new Date("2026-10-22T12:00:00Z");
  const cert = (slug: string, level: "FOUNDATIONAL" | "ASSOCIATE" | "SPECIALTY", trackOrder: number, versions: Parameters<typeof versaoVigente>[0][]) => ({
    slug,
    level,
    trackOrder,
    versions,
  });

  it("versão vigente: ativa ou aposentando antes da data; beta e aposentada não contam", () => {
    expect(versaoVigente({ status: "ACTIVE", retiresAt: null }, agora)).toBe(true);
    expect(versaoVigente({ status: "RETIRING", retiresAt: new Date("2026-12-31T00:00:00Z") }, agora)).toBe(true);
    expect(versaoVigente({ status: "RETIRING", retiresAt: new Date("2026-10-22T12:00:00Z") }, agora)).toBe(false);
    expect(versaoVigente({ status: "BETA", retiresAt: null }, agora)).toBe(false);
    expect(versaoVigente({ status: "RETIRED", retiresAt: null }, agora)).toBe(false);
  });

  it("conjunto muda com o status e a data, e sai na ordem da trilha", () => {
    const catalogo = [
      cert("networking", "SPECIALTY", 2, [{ status: "RETIRING", retiresAt: new Date("2026-12-31T00:00:00Z") }]),
      cert("saa", "ASSOCIATE", 1, [{ status: "ACTIVE", retiresAt: null }]),
      cert("beta-nova", "FOUNDATIONAL", 3, [{ status: "BETA", retiresAt: null }]),
      cert("clf", "FOUNDATIONAL", 1, [
        { status: "RETIRED", retiresAt: new Date("2023-09-18T00:00:00Z") },
        { status: "ACTIVE", retiresAt: null },
      ]),
      cert("antiga", "SPECIALTY", 1, [{ status: "RETIRED", retiresAt: new Date("2024-04-08T00:00:00Z") }]),
    ];
    expect(conjuntoGoldenJacket(catalogo, agora).map((c) => c.slug)).toEqual(["clf", "saa", "networking"]);
    expect(conjuntoGoldenJacket(catalogo, new Date("2027-01-01T00:00:00Z")).map((c) => c.slug)).toEqual(["clf", "saa"]);
  });

  it("ordena por nível e depois pela ordem sugerida", () => {
    const ordem = ordenarTrilha([
      { slug: "b", level: "ASSOCIATE" as const, trackOrder: 2 },
      { slug: "a", level: "ASSOCIATE" as const, trackOrder: 1 },
      { slug: "z", level: "FOUNDATIONAL" as const, trackOrder: 9 },
    ]);
    expect(ordem.map((c) => c.slug)).toEqual(["z", "a", "b"]);
  });
});
