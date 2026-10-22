import { describe, expect, it } from "vitest";
import {
  LIMITE_DIARIO_SEG,
  MAX_SESSAO_SEG,
  ajustarAoLimiteDiario,
  calcularEncerramento,
  duracaoEfetivaSeg,
  duracaoPausaSeg,
  estadoPomodoro,
  estadoSessao,
  segundosPorDia,
  validarConflitos,
  validarLancamentoManual,
  POMODORO_PADRAO,
} from "@/lib/estudo/sessoes";

const d = (iso: string) => new Date(iso);
const h = 3600;

describe("duração efetiva", () => {
  it("desconta pausas fechadas e a pausa aberta", () => {
    const inicio = d("2026-10-08T12:00:00Z");
    const pausas = [
      { startedAt: d("2026-10-08T12:10:00Z"), endedAt: d("2026-10-08T12:20:00Z") },
      { startedAt: d("2026-10-08T12:50:00Z"), endedAt: null },
    ];
    expect(duracaoEfetivaSeg(inicio, d("2026-10-08T13:00:00Z"), pausas)).toBe(40 * 60);
    const estado = estadoSessao({ startedAt: inicio, pauses: pausas }, d("2026-10-08T13:00:00Z"));
    expect(estado.pausada).toBe(true);
    expect(estado.efetivoSeg).toBe(40 * 60);
  });

  it("retoma do estado do servidor depois de fechar a aba (só depende de startedAt e pausas)", () => {
    const s = { startedAt: d("2026-10-08T12:00:00Z"), pauses: [] };
    expect(estadoSessao(s, d("2026-10-08T12:45:30Z")).efetivoSeg).toBe(45 * 60 + 30);
  });
});

describe("limite de 4h da sessão cronometrada", () => {
  it("encerra normalmente abaixo de 4h", () => {
    const enc = calcularEncerramento({ startedAt: d("2026-10-08T10:00:00Z"), pauses: [] }, d("2026-10-08T12:00:00Z"));
    expect(enc).toEqual({ endedAt: d("2026-10-08T12:00:00Z"), durationSec: 2 * h, autoClosed: false });
  });

  it("acima de 4h encerra no instante das 4h efetivas e pede confirmação", () => {
    const enc = calcularEncerramento(
      {
        startedAt: d("2026-10-08T08:00:00Z"),
        pauses: [{ startedAt: d("2026-10-08T09:00:00Z"), endedAt: d("2026-10-08T09:30:00Z") }],
      },
      d("2026-10-08T20:00:00Z"),
    );
    expect(enc.autoClosed).toBe(true);
    expect(enc.durationSec).toBe(MAX_SESSAO_SEG);
    // 1h + pausa 30 min + 3h = 12:30
    expect(enc.endedAt.toISOString()).toBe("2026-10-08T12:30:00.000Z");
  });

  it("encerrar durante uma pausa termina no início da pausa", () => {
    const enc = calcularEncerramento(
      { startedAt: d("2026-10-08T10:00:00Z"), pauses: [{ startedAt: d("2026-10-08T11:00:00Z"), endedAt: null }] },
      d("2026-10-08T11:40:00Z"),
    );
    expect(enc.endedAt.toISOString()).toBe("2026-10-08T11:00:00.000Z");
    expect(enc.durationSec).toBe(h);
  });

  it("lançamento manual acima de 4h é recusado", () => {
    const erro = validarLancamentoManual(
      { inicio: d("2026-10-08T10:00:00Z"), fim: d("2026-10-08T14:01:00Z") },
      [],
      d("2026-10-08T20:00:00Z"),
    );
    expect(erro?.code).toBe("max4h");
    expect(
      validarLancamentoManual(
        { inicio: d("2026-10-08T10:00:00Z"), fim: d("2026-10-08T14:00:00Z") },
        [],
        d("2026-10-08T20:00:00Z"),
      ),
    ).toBeNull();
  });

  it("lançamento manual no futuro é recusado", () => {
    const erro = validarLancamentoManual(
      { inicio: d("2026-10-08T19:00:00Z"), fim: d("2026-10-08T21:00:00Z") },
      [],
      d("2026-10-08T20:00:00Z"),
    );
    expect(erro?.code).toBe("futuro");
  });
});

describe("sobreposição", () => {
  const existentes = [{ inicio: d("2026-10-08T10:00:00Z"), fim: d("2026-10-08T11:00:00Z"), durationSec: h }];

  it("recusa sessão que se sobrepõe a outra (cronometrada ou manual)", () => {
    const erro = validarConflitos(
      { inicio: d("2026-10-08T10:30:00Z"), fim: d("2026-10-08T11:30:00Z"), durationSec: h },
      existentes,
    );
    expect(erro?.code).toBe("sobreposicao");
  });

  it("aceita sessão encostada (fim de uma = início da outra)", () => {
    expect(
      validarConflitos(
        { inicio: d("2026-10-08T11:00:00Z"), fim: d("2026-10-08T12:00:00Z"), durationSec: h },
        existentes,
      ),
    ).toBeNull();
  });
});

describe("limite diário de 16h", () => {
  // Dia 2026-10-08 em São Paulo começa 03:00 UTC.
  const existentes = [
    { inicio: d("2026-10-08T03:00:00Z"), fim: d("2026-10-08T07:00:00Z"), durationSec: 4 * h },
    { inicio: d("2026-10-08T07:00:00Z"), fim: d("2026-10-08T11:00:00Z"), durationSec: 4 * h },
    { inicio: d("2026-10-08T11:00:00Z"), fim: d("2026-10-08T15:00:00Z"), durationSec: 4 * h },
    { inicio: d("2026-10-08T15:00:00Z"), fim: d("2026-10-08T18:00:00Z"), durationSec: 3 * h },
  ];

  it("recusa o lançamento que passa de 16h no dia", () => {
    const erro = validarConflitos(
      { inicio: d("2026-10-08T19:00:00Z"), fim: d("2026-10-08T21:00:00Z"), durationSec: 2 * h },
      existentes,
    );
    expect(erro?.code).toBe("limite16h");
  });

  it("aceita exatamente 16h", () => {
    expect(
      validarConflitos(
        { inicio: d("2026-10-08T19:00:00Z"), fim: d("2026-10-08T20:00:00Z"), durationSec: h },
        existentes,
      ),
    ).toBeNull();
  });

  it("ajusta a sessão cronometrada para caber no limite", () => {
    const novo = { inicio: d("2026-10-08T19:00:00Z"), fim: d("2026-10-08T21:00:00Z"), durationSec: 2 * h };
    expect(ajustarAoLimiteDiario(novo, existentes)).toBe(LIMITE_DIARIO_SEG - 15 * h);
  });

  it("sessão que atravessa a meia-noite conta em cada dia separadamente", () => {
    // 23:00 → 01:00 BRT: 1h em cada dia; não estoura o dia 08 (15h + 1h = 16h).
    const novo = { inicio: d("2026-10-09T02:00:00Z"), fim: d("2026-10-09T04:00:00Z"), durationSec: 2 * h };
    expect(validarConflitos(novo, existentes)).toBeNull();
  });
});

describe("sessão atravessando a meia-noite", () => {
  it("divide o tempo efetivo entre os dois dias de São Paulo", () => {
    // 22:30 BRT de 08/10 até 00:30 BRT de 09/10 (90 + 30 min de relógio), com 20 min de pausa:
    // 100 min efetivos repartidos na proporção do relógio.
    const partes = segundosPorDia([
      { inicio: d("2026-10-09T01:30:00Z"), fim: d("2026-10-09T03:30:00Z"), durationSec: 100 * 60 },
    ]);
    expect(partes.get("2026-10-08")).toBe(75 * 60);
    expect(partes.get("2026-10-09")).toBe(25 * 60);
  });
});

describe("Pomodoro", () => {
  it("calcula o bloco atual e o tempo restante", () => {
    expect(estadoPomodoro(30 * 60, POMODORO_PADRAO)).toEqual({ bloco: 2, restanteSeg: 20 * 60, concluidos: 1 });
  });

  it("pausa longa a cada 4 blocos", () => {
    expect(duracaoPausaSeg(1, POMODORO_PADRAO)).toBe(5 * 60);
    expect(duracaoPausaSeg(4, POMODORO_PADRAO)).toBe(15 * 60);
  });
});
