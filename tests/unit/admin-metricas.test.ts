import { describe, expect, it } from "vitest";
import { calcularChurn, calcularMrr, type AssinaturaMetrica } from "@/lib/admin/metricas";

const agora = new Date("2026-10-24T12:00:00Z");
const depois = new Date("2026-11-24T12:00:00Z");
const antes = new Date("2026-10-01T12:00:00Z");
const base = { graceUntil: null, accessUntil: null };
const precos = { MENSAL: { centavos: 2990 }, ANUAL: { centavos: 23900 }, ANUAL_PIX: { centavos: 23900 } };
const intervalo = (p: string | null) =>
  p === "m" ? ("MENSAL" as const) : p === "a" ? ("ANUAL" as const) : p === "pix" ? ("ANUAL_PIX" as const) : null;
const mrr = (subs: AssinaturaMetrica[]) => calcularMrr(subs, intervalo, agora, precos);

describe("calcularMrr", () => {
  it("mensal conta inteiro; anual e Pix anual divididos por 12", () => {
    expect(
      mrr([
        { ...base, status: "active", priceId: "m" },
        { ...base, status: "active", priceId: "a" },
        { status: null, graceUntil: null, accessUntil: depois, priceId: "pix" },
      ]),
    ).toEqual({ mrrCents: Math.round(2990 + 23900 / 12 + 23900 / 12), pagantes: 3, emTeste: 0, semPreco: 0 });
  });

  it("trial, cancelada, carência vencida e Pix vencido não entram", () => {
    expect(
      mrr([
        { ...base, status: "trialing", priceId: "m" },
        { ...base, status: "canceled", priceId: "m" },
        { ...base, status: "past_due", graceUntil: antes, priceId: "m" },
        { status: null, graceUntil: null, accessUntil: antes, priceId: "pix" },
      ]),
    ).toEqual({ mrrCents: 0, pagantes: 0, emTeste: 1, semPreco: 0 });
  });

  it("past_due na carência ainda conta; preço desconhecido fica de fora", () => {
    expect(
      mrr([
        { ...base, status: "past_due", graceUntil: depois, priceId: "m" },
        { ...base, status: "active", priceId: "price_antigo" },
      ]),
    ).toEqual({ mrrCents: 2990, pagantes: 2, emTeste: 0, semPreco: 1 });
  });
});

describe("calcularChurn", () => {
  it("canceladas sobre a base estimada; zero sem base", () => {
    expect(calcularChurn(1, 9)).toBe(0.1);
    expect(calcularChurn(0, 0)).toBe(0);
    expect(calcularChurn(2, 0)).toBe(1);
  });
});
