import { describe, expect, it } from "vitest";
import { dividirPorDia, getDayKey, getWeekKey, intervaloDaChave, intervaloDaSemana } from "@/lib/estudo/tempo";

describe("getWeekKey", () => {
  it("usa o fuso de São Paulo na virada de domingo para segunda", () => {
    // Domingo 2026-10-11 23:30 BRT = segunda 02:30 UTC
    expect(getWeekKey(new Date("2026-10-12T02:30:00Z"))).toBe("2026-W41");
    // Segunda 2026-10-12 00:00 BRT = 03:00 UTC
    expect(getWeekKey(new Date("2026-10-12T03:00:00Z"))).toBe("2026-W42");
  });

  it("trata a virada de ano pela semana ISO", () => {
    // 2027-01-01 (sexta) pertence à semana 53 de 2026
    expect(getWeekKey(new Date("2027-01-01T15:00:00Z"))).toBe("2026-W53");
    expect(getWeekKey(new Date("2027-01-04T15:00:00Z"))).toBe("2027-W01");
  });

  it("é consistente com o intervalo da chave", () => {
    const { inicio, fim } = intervaloDaChave("2026-W41");
    expect(inicio.toISOString()).toBe("2026-10-05T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-10-12T03:00:00.000Z");
    expect(intervaloDaSemana(new Date("2026-10-08T12:00:00Z")).inicio.toISOString()).toBe(inicio.toISOString());
  });

  it("aceita datas antigas com horário de verão (2018)", () => {
    // 2018-11-04 começou o horário de verão (UTC-2): 02:30 UTC já é segunda 00:30
    expect(getWeekKey(new Date("2018-11-05T02:30:00Z"))).toBe("2018-W45");
  });
});

describe("getDayKey e dividirPorDia", () => {
  it("usa o dia de São Paulo", () => {
    expect(getDayKey(new Date("2026-10-09T02:00:00Z"))).toBe("2026-10-08");
  });

  it("divide sessão que atravessa a meia-noite", () => {
    const partes = dividirPorDia(new Date("2026-10-09T02:30:00Z"), new Date("2026-10-09T03:45:00Z"));
    expect(partes.get("2026-10-08")).toBe(30 * 60);
    expect(partes.get("2026-10-09")).toBe(45 * 60);
  });
});
