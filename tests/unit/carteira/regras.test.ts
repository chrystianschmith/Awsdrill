import { describe, expect, it } from "vitest";
import { calcularVencimento, diasParaVencer, lembreteDevido, situacao } from "@/lib/carteira/regras";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
// 12:00 em São Paulo
const em = (iso: string) => new Date(`${iso}T15:00:00Z`);

describe("calcularVencimento", () => {
  it("soma 36 meses no mesmo dia", () => {
    expect(calcularVencimento(d("2026-10-15"), 36)).toEqual(d("2029-10-15"));
  });
  it("29 de fevereiro vira o último dia do mês", () => {
    expect(calcularVencimento(d("2028-02-29"), 36)).toEqual(d("2031-02-28"));
    expect(calcularVencimento(d("2026-01-31"), 1)).toEqual(d("2026-02-28"));
  });
});

describe("situacao", () => {
  const vence = d("2027-01-31");
  it("reprovado não tem validade", () => {
    expect(situacao({ result: "FAILED", expiresAt: null }, em("2026-10-24"))).toBe("reprovado");
  });
  it("válida, vence em breve (90 dias) e vencida", () => {
    expect(situacao({ result: "PASSED", expiresAt: vence }, em("2026-10-24"))).toBe("valida");
    expect(situacao({ result: "PASSED", expiresAt: vence }, em("2026-11-02"))).toBe("vence_em_breve");
    expect(situacao({ result: "PASSED", expiresAt: vence }, em("2027-01-31"))).toBe("vence_em_breve");
    expect(situacao({ result: "PASSED", expiresAt: vence }, em("2027-02-01"))).toBe("vencida");
  });
  it("conta o dia em São Paulo, não em UTC", () => {
    // 23:30 de 30/01 em São Paulo já é 31/01 em UTC.
    expect(diasParaVencer(vence, new Date("2027-01-31T02:30:00Z"))).toBe(1);
  });
});

describe("lembreteDevido", () => {
  const vence = d("2027-06-30");
  it("nada antes de 180 dias", () => {
    expect(lembreteDevido(vence, em("2026-12-01"), null)).toBeNull();
  });
  it("cada estágio uma vez, na ordem", () => {
    expect(lembreteDevido(vence, em("2027-01-01"), null)).toBe(180);
    expect(lembreteDevido(vence, em("2027-01-02"), 180)).toBeNull();
    expect(lembreteDevido(vence, em("2027-04-01"), 180)).toBe(90);
    expect(lembreteDevido(vence, em("2027-06-01"), 90)).toBe(30);
    expect(lembreteDevido(vence, em("2027-06-23"), 30)).toBe(7);
    expect(lembreteDevido(vence, em("2027-06-30"), 7)).toBe(0);
    expect(lembreteDevido(vence, em("2027-07-05"), 0)).toBeNull();
  });
  it("cadastro perto do fim pula os estágios atrasados", () => {
    expect(lembreteDevido(vence, em("2027-06-10"), null)).toBe(30);
  });
  it("vencida há mais de 30 dias não gera aviso", () => {
    expect(lembreteDevido(vence, em("2027-07-15"), 7)).toBe(0);
    expect(lembreteDevido(vence, em("2027-08-15"), null)).toBeNull();
  });
});
