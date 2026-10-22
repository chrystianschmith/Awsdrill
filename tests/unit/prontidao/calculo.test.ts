import { describe, expect, it } from "vitest";
import {
  calcularProntidao,
  JANELA_DIAS,
  METODOLOGIA_VERSAO,
  MINIMO_POR_TAREFA,
  pesoPorIdade,
  planoDeCorrecao,
  type RespostaParaProntidao,
  taxaDeAcertoPorDominio,
  wilson,
} from "@/lib/prontidao/calculo";

const AGORA = new Date("2026-10-22T12:00:00Z");
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000);

// Dois domínios: D1 (60%, tarefas a e b) e D2 (40%, tarefa c).
const BLUEPRINT = [
  { id: "D1", peso: 60, tarefas: ["a", "b"] },
  { id: "D2", peso: 40, tarefas: ["c"] },
];

function resp(topicId: string | null, isCorrect: boolean, dias = 0, domainId?: string): RespostaParaProntidao {
  const dominio = domainId ?? (topicId === "c" ? "D2" : "D1");
  return { domainId: dominio, topicId, isCorrect, answeredAt: diasAtras(dias) };
}

const muitas = (topicId: string, certas: number, erradas: number, dias = 0) => [
  ...Array.from({ length: certas }, () => resp(topicId, true, dias)),
  ...Array.from({ length: erradas }, () => resp(topicId, false, dias)),
];

/** Gerador determinístico para as propriedades. */
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

describe("wilson", () => {
  it("bate com valores conhecidos e fica em [0, 1]", () => {
    const r = wilson(8, 10);
    expect(r.inferior).toBeCloseTo(0.4902, 3);
    expect(r.superior).toBeCloseTo(0.9433, 3);
    expect(wilson(0, 5).inferior).toBe(0);
    expect(wilson(5, 5).superior).toBeCloseTo(1, 10);
    expect(wilson(0, 0)).toEqual({ inferior: 0, superior: 1 });
  });
});

describe("decaimento", () => {
  it("meia-vida de 30 dias", () => {
    expect(pesoPorIdade(AGORA, AGORA)).toBe(1);
    expect(pesoPorIdade(diasAtras(30), AGORA)).toBeCloseTo(0.5, 10);
    expect(pesoPorIdade(diasAtras(60), AGORA)).toBeCloseTo(0.25, 10);
  });

  it("acertos antigos valem menos que recentes; fora da janela não contam", () => {
    const recente = calcularProntidao(muitas("c", 4, 0, 0), BLUEPRINT, AGORA);
    const antiga = calcularProntidao(muitas("c", 4, 0, 60), BLUEPRINT, AGORA);
    expect(antiga.dominios[1]!.score).toBeLessThan(recente.dominios[1]!.score);
    const fora = calcularProntidao(muitas("c", 4, 0, JANELA_DIAS + 1), BLUEPRINT, AGORA);
    expect(fora.sampleSize).toBe(0);
    expect(fora.score).toBe(0);
  });

  it("erro recente pesa mais que acerto antigo", () => {
    const r = calcularProntidao(
      [...muitas("c", 5, 0, 90), ...muitas("c", 0, 5, 0)],
      [{ id: "D2", peso: 100, tarefas: ["c"] }],
      AGORA,
    );
    expect(r.score).toBeLessThan(20);
  });
});

describe("amostra pequena", () => {
  it("sem respostas: 0 com faixa 0–100, sem cobertura, insuficiente", () => {
    const r = calcularProntidao([], BLUEPRINT, AGORA);
    expect(r).toMatchObject({ score: 0, lowerBound: 0, upperBound: 100, coverage: 0, sampleSize: 0 });
    expect(r.suficiente).toBe(false);
    expect(r.methodologyVersion).toBe(METODOLOGIA_VERSAO);
  });

  it("um acerto não vira 100: as respostas que faltam até o mínimo contam como erro", () => {
    const r = calcularProntidao([resp("c", true)], [{ id: "D2", peso: 100, tarefas: ["c"] }], AGORA);
    expect(r.score).toBeCloseTo(100 / MINIMO_POR_TAREFA, 1);
    expect(r.coverage).toBe(0);
    expect(r.lowerBound).toBeLessThan(r.score);
    expect(r.upperBound).toBe(100);
  });

  it("a faixa estreita com mais respostas e sempre contém o escore", () => {
    const um = (n: number) =>
      calcularProntidao(muitas("c", Math.round(n * 0.8), n - Math.round(n * 0.8)), BLUEPRINT.slice(1), AGORA);
    const pequena = um(5);
    const grande = um(100);
    expect(grande.upperBound - grande.lowerBound).toBeLessThan(pequena.upperBound - pequena.lowerBound);
    for (const r of [pequena, grande]) {
      expect(r.lowerBound).toBeLessThanOrEqual(r.score);
      expect(r.score).toBeLessThanOrEqual(r.upperBound);
    }
    expect(grande.score).toBe(80);
    expect(grande.suficiente).toBe(true);
  });
});

describe("cobertura", () => {
  it("tarefa sem resposta puxa o domínio e o exame para baixo", () => {
    const so_a = calcularProntidao(muitas("a", 10, 0), BLUEPRINT, AGORA);
    expect(so_a.dominios[0]).toMatchObject({ score: 50, coverage: 0.5 });
    expect(so_a.coverage).toBeCloseTo(0.3, 10); // 60% × 0,5
    expect(so_a.score).toBe(30); // 60% × 50 + 40% × 0
    const tudo = calcularProntidao(
      [...muitas("a", 10, 0), ...muitas("b", 10, 0), ...muitas("c", 10, 0)],
      BLUEPRINT,
      AGORA,
    );
    expect(tudo).toMatchObject({ score: 100, coverage: 1 });
  });

  it("pondera os domínios pelo peso do blueprint", () => {
    const fraco1 = calcularProntidao(
      [...muitas("a", 2, 8), ...muitas("b", 2, 8), ...muitas("c", 10, 0)],
      BLUEPRINT,
      AGORA,
    );
    const fraco2 = calcularProntidao(
      [...muitas("a", 10, 0), ...muitas("b", 10, 0), ...muitas("c", 2, 8)],
      BLUEPRINT,
      AGORA,
    );
    expect(fraco1.score).toBe(52); // 60 × 20 + 40 × 100
    expect(fraco2.score).toBe(68); // 60 × 100 + 40 × 20
  });

  it("questão ligada só ao domínio (ou a tarefa aposentada) vale para todas as tarefas dele", () => {
    const r = calcularProntidao(
      [...Array.from({ length: 6 }, () => resp(null, true)), ...Array.from({ length: 6 }, () => resp("velha", true))],
      BLUEPRINT,
      AGORA,
    );
    expect(r.dominios[0]!.folhas.map((f) => f.respostas)).toEqual([6, 6]);
    expect(r.dominios[0]).toMatchObject({ score: 100, coverage: 1, sampleSize: 12 });
  });

  it("ignora respostas de domínio fora do blueprint vigente", () => {
    const r = calcularProntidao([resp(null, true, 0, "D9")], BLUEPRINT, AGORA);
    expect(r.sampleSize).toBe(0);
  });

  it("domínio sem tarefas usa as próprias respostas", () => {
    const r = calcularProntidao(
      muitas("x", 3, 1).map((x) => ({ ...x, topicId: null, domainId: "D3" })),
      [{ id: "D3", peso: 100, tarefas: [] }],
      AGORA,
    );
    expect(r).toMatchObject({ score: 75, coverage: 1 });
  });
});

describe("monotonia", () => {
  it("mais um acerto nunca baixa e mais um erro nunca sobe a estimativa", () => {
    const rnd = lcg(42);
    const folhas = ["a", "b", "c", null];
    for (let caso = 0; caso < 300; caso++) {
      const base = Array.from({ length: Math.floor(rnd() * 25) }, () =>
        resp(folhas[Math.floor(rnd() * 4)]!, rnd() < 0.6, Math.floor(rnd() * 120)),
      );
      const alvo = folhas[Math.floor(rnd() * 4)]!;
      const dias = Math.floor(rnd() * 120);
      const antes = calcularProntidao(base, BLUEPRINT, AGORA);
      const comAcerto = calcularProntidao([...base, resp(alvo, true, dias)], BLUEPRINT, AGORA);
      const comErro = calcularProntidao([...base, resp(alvo, false, dias)], BLUEPRINT, AGORA);
      expect(comAcerto.score).toBeGreaterThanOrEqual(antes.score);
      expect(comAcerto.lowerBound).toBeGreaterThanOrEqual(antes.lowerBound);
      expect(comErro.score).toBeLessThanOrEqual(antes.score);
      expect(comErro.lowerBound).toBeLessThanOrEqual(antes.lowerBound);
    }
  });
});

describe("plano de correção", () => {
  it("prioriza o que mais pesa e falta; ignora tarefa coberta acima do alvo", () => {
    const r = calcularProntidao([...muitas("a", 10, 0), ...muitas("b", 1, 0), ...muitas("c", 3, 7)], BLUEPRINT, AGORA);
    const plano = planoDeCorrecao(r);
    expect(plano.map((p) => [p.topicId, p.motivo])).toEqual([
      ["c", "acerto_baixo"], // 40% × 0,7
      ["b", "amostra_pequena"], // 60% × 0,67 / 2 tarefas
    ]);
    expect(planoDeCorrecao(calcularProntidao([], BLUEPRINT, AGORA)).map((p) => p.motivo)).toEqual([
      "sem_respostas",
      "sem_respostas",
      "sem_respostas",
    ]);
  });
});

describe("taxa de acerto para o ciclo", () => {
  it("por domínio, com decaimento; domínio sem respostas fica de fora", () => {
    const t = taxaDeAcertoPorDominio([...muitas("a", 3, 1), resp("c", false, 30), resp("c", true, 0)], AGORA);
    expect(t.get("D1")).toBeCloseTo(0.75, 10);
    expect(t.get("D2")).toBeCloseTo(1 / 1.5, 10);
    expect(t.has("D3")).toBe(false);
  });
});
