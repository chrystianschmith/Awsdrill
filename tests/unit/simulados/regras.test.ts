import { describe, expect, it } from "vitest";
import {
  corrigir,
  cotasPorDominio,
  dentroDoPrazo,
  hashQuestao,
  prazoDaProva,
  relatorioPorDominio,
  selecaoValida,
  sortearQuestoes,
  tempoDeResposta,
} from "@/lib/simulados/regras";
import { ArquivoQuestoes, QuestaoImportada } from "@/lib/simulados/schemas";

/** Gerador determinístico (mulberry32) para sorteios reproduzíveis. */
function semente(s: number) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const soma = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("cotas do sorteio", () => {
  it("batem com os pesos do blueprint e somam n", () => {
    // CLF-C02: 24 / 30 / 34 / 12, banco farto.
    const cotas = cotasPorDominio(
      [
        { domainId: "1", peso: 24, disponiveis: 100 },
        { domainId: "2", peso: 30, disponiveis: 100 },
        { domainId: "3", peso: 34, disponiveis: 100 },
        { domainId: "4", peso: 12, disponiveis: 100 },
      ],
      65,
    );
    expect(soma(cotas)).toBe(65);
    // 15,6 / 19,5 / 22,1 / 7,8 → sobram 2 para os maiores restos (domínios 4 e 1).
    expect([...cotas.values()]).toEqual([16, 19, 22, 8]);
  });

  it("domínio com banco curto fica cheio e o resto é redistribuído pelo peso", () => {
    const cotas = cotasPorDominio(
      [
        { domainId: "a", peso: 50, disponiveis: 3 },
        { domainId: "b", peso: 25, disponiveis: 100 },
        { domainId: "c", peso: 25, disponiveis: 100 },
      ],
      20,
    );
    expect(cotas.get("a")).toBe(3);
    expect(cotas.get("b")! + cotas.get("c")!).toBe(17);
    expect(Math.abs(cotas.get("b")! - cotas.get("c")!)).toBeLessThanOrEqual(1);
  });

  it("banco menor que n devolve tudo o que existe; n zero devolve nada", () => {
    const dominios = [
      { domainId: "a", peso: 1, disponiveis: 2 },
      { domainId: "b", peso: 1, disponiveis: 1 },
      { domainId: "c", peso: 1, disponiveis: 0 },
    ];
    expect(Object.fromEntries(cotasPorDominio(dominios, 10))).toEqual({ a: 2, b: 1, c: 0 });
    expect(soma(cotasPorDominio(dominios, 0))).toBe(0);
  });

  it("sorteio respeita as cotas, prefere questões não vistas e não repete", () => {
    const banco = [
      ...Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, domainId: "a", vista: i < 20 })),
      ...Array.from({ length: 30 }, (_, i) => ({ id: `b${i}`, domainId: "b", vista: false })),
      { id: "fora", domainId: "z", vista: false },
    ];
    const ids = sortearQuestoes(
      banco,
      new Map([
        ["a", 75],
        ["b", 25],
      ]),
      20,
      semente(42),
    );
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
    expect(ids).not.toContain("fora");
    const doA = ids.filter((id) => id.startsWith("a"));
    expect(doA).toHaveLength(15);
    // As 10 não vistas do domínio "a" (a20…a29) entram antes de qualquer vista.
    for (let i = 20; i < 30; i++) expect(doA).toContain(`a${i}`);
  });
});

describe("correção e prazo", () => {
  it("só acerta quem marca exatamente as corretas", () => {
    expect(corrigir(["B"], ["B"])).toBe(true);
    expect(corrigir(["A", "C"], ["C", "A"])).toBe(true);
    expect(corrigir(["A", "C"], ["A"])).toBe(false);
    expect(corrigir(["A", "C"], ["A", "B"])).toBe(false);
  });

  it("seleção precisa ter a quantidade pedida e chaves da questão", () => {
    const chaves = ["A", "B", "C", "D", "E"];
    expect(selecaoValida(chaves, 2, ["A", "E"])).toBe(true);
    expect(selecaoValida(chaves, 2, ["A"])).toBe(false);
    expect(selecaoValida(chaves, 2, ["A", "A"])).toBe(false);
    expect(selecaoValida(chaves, 1, ["F"])).toBe(false);
  });

  it("prazo expirado recusa resposta (com folga de 5 s); treino não tem prazo", () => {
    const inicio = new Date("2026-10-22T12:00:00Z");
    const prazo = prazoDaProva(inicio, 90);
    expect(prazo.toISOString()).toBe("2026-10-22T13:30:00.000Z");
    expect(dentroDoPrazo(prazo, new Date("2026-10-22T13:30:04Z"))).toBe(true);
    expect(dentroDoPrazo(prazo, new Date("2026-10-22T13:30:06Z"))).toBe(false);
    expect(dentroDoPrazo(null, new Date("2030-01-01T00:00:00Z"))).toBe(true);
  });

  it("tempo de resposta medido no servidor tem teto de 15 min", () => {
    const t0 = new Date("2026-10-22T12:00:00Z");
    expect(tempoDeResposta(t0, new Date("2026-10-22T12:01:30Z"))).toBe(90_000);
    expect(tempoDeResposta(t0, new Date("2026-10-22T14:00:00Z"))).toBe(15 * 60_000);
  });

  it("relatório por domínio conta sem resposta como errada", () => {
    const r = relatorioPorDominio(
      [
        { id: "q1", domainId: "1" },
        { id: "q2", domainId: "1" },
        { id: "q3", domainId: "2" },
        { id: "q4", domainId: "2" },
      ],
      [
        { questionId: "q1", isCorrect: true },
        { questionId: "q2", isCorrect: false },
        { questionId: "q3", isCorrect: true },
      ],
    );
    expect(r).toMatchObject({ corretas: 2, total: 4, pct: 50 });
    expect(r.dominios).toEqual([
      { domainId: "1", total: 2, corretas: 1, pct: 50 },
      { domainId: "2", total: 2, corretas: 1, pct: 50 },
    ]);
  });
});

describe("importação do banco", () => {
  const base = {
    dominio: "1.1",
    tipo: "SINGLE" as const,
    enunciado: "Qual serviço oferece armazenamento de objetos com alta durabilidade?",
    alternativas: [
      { key: "A" as const, text: "Amazon S3" },
      { key: "B" as const, text: "Amazon EBS" },
      { key: "C" as const, text: "Amazon EC2" },
      { key: "D" as const, text: "Amazon VPC" },
    ],
    corretas: ["A" as const],
    explicacao: "O Amazon S3 é o serviço de armazenamento de objetos da AWS.",
    fontes: ["https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html"],
  };

  it("aceita questão bem formada", () => {
    expect(QuestaoImportada.safeParse(base).success).toBe(true);
  });

  it("recusa gabarito incoerente, chaves fora de ordem e fonte não oficial", () => {
    const casos = [
      { ...base, corretas: ["A", "B"] },
      { ...base, tipo: "MULTIPLE", corretas: ["A"] },
      { ...base, tipo: "MULTIPLE", corretas: ["A", "B", "C", "D"] },
      { ...base, corretas: ["E"] },
      { ...base, alternativas: [...base.alternativas.slice(0, 3), { key: "E", text: "Outra" }] },
      { ...base, alternativas: [...base.alternativas.slice(0, 3), { key: "D", text: "amazon s3" }] },
      { ...base, fontes: ["http://docs.aws.amazon.com/x"] },
      { ...base, fontes: ["https://exemplo.com/dump"] },
      { ...base, fontes: [] },
    ];
    for (const c of casos) expect(QuestaoImportada.safeParse(c).success, JSON.stringify(c)).toBe(false);
  });

  it("arquivo exige código do exame e origem conhecida", () => {
    expect(ArquivoQuestoes.safeParse({ exame: "CLF-C02", origem: "autoral", questoes: [base] }).success).toBe(true);
    expect(ArquivoQuestoes.safeParse({ exame: "clf", origem: "autoral", questoes: [base] }).success).toBe(false);
    expect(ArquivoQuestoes.safeParse({ exame: "CLF-C02", origem: "dump", questoes: [base] }).success).toBe(false);
  });

  it("hash ignora caixa, espaços e ordem das alternativas", () => {
    const h = hashQuestao(base.enunciado, base.alternativas);
    expect(hashQuestao(`  ${base.enunciado.toUpperCase()} `, [...base.alternativas].reverse())).toBe(h);
    expect(hashQuestao(base.enunciado, base.alternativas.slice(1))).not.toBe(h);
  });
});
