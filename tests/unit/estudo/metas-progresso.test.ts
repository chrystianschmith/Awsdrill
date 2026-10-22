import { describe, expect, it } from "vitest";
import { calcularStreak, progressoMeta } from "@/lib/estudo/metas";
import { progressoDominio, progressoExame, statusAoEstudar } from "@/lib/estudo/progresso";
import { segundosPorDia } from "@/lib/estudo/sessoes";

const min = 60;

describe("streak", () => {
  const agora = new Date("2026-10-08T15:00:00Z"); // 12:00 BRT de 08/10

  it("conta dias consecutivos com o mínimo, incluindo hoje", () => {
    const dias = new Map([
      ["2026-10-08", 40 * min],
      ["2026-10-07", 30 * min],
      ["2026-10-06", 60 * min],
    ]);
    expect(calcularStreak(dias, agora, 30)).toBe(3);
  });

  it("hoje vazio não quebra a sequência", () => {
    const dias = new Map([
      ["2026-10-07", 30 * min],
      ["2026-10-06", 60 * min],
    ]);
    expect(calcularStreak(dias, agora, 30)).toBe(2);
  });

  it("um dia vazio no meio quebra a sequência", () => {
    const dias = new Map([
      ["2026-10-08", 40 * min],
      ["2026-10-07", 0],
      ["2026-10-06", 60 * min],
    ]);
    expect(calcularStreak(dias, agora, 30)).toBe(1);
  });

  it("dia abaixo do mínimo configurado não conta", () => {
    const dias = new Map([
      ["2026-10-08", 40 * min],
      ["2026-10-07", 29 * min],
    ]);
    expect(calcularStreak(dias, agora, 30)).toBe(1);
    expect(calcularStreak(dias, agora, 20)).toBe(2);
  });

  it("usa o dia de São Paulo, não o de UTC", () => {
    // 23:00 BRT de 06/10 (02:00 UTC de 07/10) e 12:00 BRT de 07/10: em UTC seriam o mesmo dia.
    const dias = segundosPorDia([
      { inicio: new Date("2026-10-07T02:00:00Z"), fim: new Date("2026-10-07T02:40:00Z"), durationSec: 40 * min },
      { inicio: new Date("2026-10-07T15:00:00Z"), fim: new Date("2026-10-07T15:40:00Z"), durationSec: 40 * min },
    ]);
    expect(dias.get("2026-10-06")).toBe(40 * min);
    expect(dias.get("2026-10-07")).toBe(40 * min);
    expect(calcularStreak(dias, agora, 30)).toBe(2);
    // 00:30 BRT de 08/10 (03:30 UTC): hoje ainda vazio, a sequência continua.
    expect(calcularStreak(dias, new Date("2026-10-08T03:30:00Z"), 30)).toBe(2);
  });
});

describe("meta diária", () => {
  it("limita a 100% e indica quando atingiu", () => {
    expect(progressoMeta(60 * min, 120)).toEqual({ minutos: 60, pct: 50, atingida: false });
    expect(progressoMeta(150 * min, 120)).toEqual({ minutos: 150, pct: 100, atingida: true });
  });
});

describe("progresso", () => {
  it("domínio = tarefas concluídas / total (revisar conta como concluído)", () => {
    expect(progressoDominio(["CONCLUIDO", "REVISAR", "ESTUDANDO", "NAO_INICIADO"])).toEqual({
      concluidos: 2,
      total: 4,
      pct: 50,
    });
    expect(progressoDominio([])).toEqual({ concluidos: 0, total: 0, pct: 0 });
  });

  it("estudar uma tarefa não iniciada a coloca em estudo", () => {
    expect(statusAoEstudar("NAO_INICIADO")).toBe("ESTUDANDO");
    expect(statusAoEstudar("CONCLUIDO")).toBe("CONCLUIDO");
  });

  it("exame é ponderado pelo peso do blueprint", () => {
    const pct = progressoExame([
      { peso: 30, concluidos: 3, total: 3 }, // 100%
      { peso: 70, concluidos: 0, total: 5 }, // 0%
    ]);
    expect(pct).toBe(30);
  });

  it("domínio sem peso publicado entra com a média dos pesos conhecidos; sem tarefas fica de fora", () => {
    expect(
      progressoExame([
        { peso: 20, concluidos: 1, total: 1 }, // 100%
        { peso: null, concluidos: 0, total: 2 }, // 0%, peso 20 (média)
        { peso: 60, concluidos: 0, total: 0 },
      ]),
    ).toBe(50);
    expect(progressoExame([{ peso: null, concluidos: 1, total: 2 }])).toBe(50);
    expect(progressoExame([])).toBe(0);
  });
});
