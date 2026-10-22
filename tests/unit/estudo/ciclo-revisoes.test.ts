import { describe, expect, it } from "vitest";
import {
  CicloInvalidoError,
  cicloCumprido,
  distribuirCiclo,
  fatorDesempenho,
  proximoDominio,
} from "@/lib/estudo/ciclo";
import {
  ordenarVencidas,
  primeiraRevisao,
  proximaRevisao,
  proximoFlashcard,
  diasDeAtraso,
} from "@/lib/estudo/revisoes";
import { pesosEfetivos } from "@/lib/estudo/progresso";

const soma = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("distribuição do ciclo", () => {
  it("soma exatamente as horas do ciclo", () => {
    const dist = distribuirCiclo(
      [
        { domainId: "a", peso: 3, taxaAcerto: 0.8 },
        { domainId: "b", peso: 2, taxaAcerto: 0.5 },
        { domainId: "c", peso: 1, taxaAcerto: null },
      ],
      601,
    );
    expect(soma(dist)).toBe(601);
  });

  it("pondera peso × (1 + (1 − taxa)) e sem questões o fator é 1", () => {
    expect(fatorDesempenho(null)).toBe(1);
    expect(fatorDesempenho(0.75)).toBe(1.25);
    expect(fatorDesempenho(0)).toBe(2);
    // a: 1 × 2 (0% de acerto) = 2; b: 1 × 1 (sem questões) = 1 → 2/3 e 1/3 de 300.
    const dist = distribuirCiclo(
      [
        { domainId: "a", peso: 1, taxaAcerto: 0 },
        { domainId: "b", peso: 1, taxaAcerto: null },
      ],
      300,
    );
    expect(dist.get("a")).toBe(200);
    expect(dist.get("b")).toBe(100);
  });

  it("garante no mínimo 30 min por matéria e redistribui o restante", () => {
    const dist = distribuirCiclo(
      [
        { domainId: "grande", peso: 100, taxaAcerto: null },
        { domainId: "p1", peso: 1, taxaAcerto: null },
        { domainId: "p2", peso: 1, taxaAcerto: null },
      ],
      240,
    );
    expect(dist.get("p1")).toBe(30);
    expect(dist.get("p2")).toBe(30);
    expect(dist.get("grande")).toBe(180);
    expect(soma(dist)).toBe(240);
  });

  it("recusa ciclo curto demais para o mínimo", () => {
    expect(() =>
      distribuirCiclo(
        [
          { domainId: "a", peso: 1, taxaAcerto: null },
          { domainId: "b", peso: 1, taxaAcerto: null },
        ],
        50,
      ),
    ).toThrow(CicloInvalidoError);
  });

  it("próxima matéria é a de maior saldo pendente; ciclo fecha quando todas cumprem", () => {
    const itens = [
      { domainId: "a", targetMin: 120, doneMin: 100 },
      { domainId: "b", targetMin: 60, doneMin: 0 },
      { domainId: "c", targetMin: 90, doneMin: 90 },
    ];
    expect(proximoDominio(itens)?.domainId).toBe("b");
    expect(cicloCumprido(itens)).toBe(false);
    expect(cicloCumprido(itens.map((i) => ({ ...i, doneMin: i.targetMin })))).toBe(true);
    expect(proximoDominio(itens.map((i) => ({ ...i, doneMin: i.targetMin })))).toBeNull();
  });
});

describe("revisão espaçada", () => {
  // 08/10 15:00 BRT
  const agora = new Date("2026-10-08T18:00:00Z");

  it("concluir tópico agenda +1 dia (início do dia em São Paulo)", () => {
    expect(primeiraRevisao(agora)).toEqual({ step: 0, dueAt: new Date("2026-10-09T03:00:00Z") });
  });

  it("revisão boa avança para +7 e depois +30; no fim encerra", () => {
    expect(proximaRevisao(0, true, agora)).toEqual({ step: 1, dueAt: new Date("2026-10-15T03:00:00Z") });
    expect(proximaRevisao(1, true, agora)).toEqual({ step: 2, dueAt: new Date("2026-11-07T03:00:00Z") });
    expect(proximaRevisao(2, true, agora)).toBeNull();
  });

  it("revisão difícil volta para +1 dia", () => {
    expect(proximaRevisao(2, false, agora)).toEqual({ step: 0, dueAt: new Date("2026-10-09T03:00:00Z") });
  });

  it("flashcards usam o mesmo agendador (acertei/errei)", () => {
    expect(proximoFlashcard(0, true, agora).step).toBe(1);
    expect(proximoFlashcard(2, true, agora).step).toBe(2);
    expect(proximoFlashcard(2, false, agora)).toEqual({ step: 0, dueAt: new Date("2026-10-09T03:00:00Z") });
  });

  it("vencidas vêm da mais atrasada para a mais recente", () => {
    const lista = [
      { id: "ontem", dueAt: new Date("2026-10-07T03:00:00Z") },
      { id: "futura", dueAt: new Date("2026-10-10T03:00:00Z") },
      { id: "semana", dueAt: new Date("2026-10-01T03:00:00Z") },
      { id: "hoje", dueAt: new Date("2026-10-08T03:00:00Z") },
    ];
    expect(ordenarVencidas(lista, agora).map((r) => r.id)).toEqual(["semana", "ontem", "hoje"]);
    expect(diasDeAtraso(new Date("2026-10-01T03:00:00Z"), agora)).toBe(7);
  });
});

describe("peso efetivo do domínio", () => {
  it("peso a confirmar usa a média dos conhecidos; nenhum conhecido vale 1", () => {
    expect(pesosEfetivos([24, null, 36, 0])).toEqual([24, 30, 36, 30]);
    expect(pesosEfetivos([null, null])).toEqual([1, 1]);
  });
});
