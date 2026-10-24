import { describe, expect, it } from "vitest";
import {
  calcularAccessUntilPix,
  calcularCarencia,
  planejarSeguidos,
  precisaLembretePix,
  somarMesesUTC,
  trialAteFimDoPix,
} from "@/lib/assinaturas/regras";
import { economiaAnualCentavos, mensalEquivalenteAnualCentavos } from "@/lib/assinaturas/precos";

const agora = new Date("2026-10-08T12:00:00Z");
const dias = (n: number) => new Date(agora.getTime() + n * 86_400_000);

describe("accessUntil do Pix", () => {
  it("sem acesso vigente conta 12 meses a partir de agora", () => {
    expect(calcularAccessUntilPix(null, agora)).toEqual(new Date("2027-10-08T12:00:00Z"));
  });

  it("acesso expirado também conta a partir de agora", () => {
    expect(calcularAccessUntilPix(dias(-30), agora)).toEqual(new Date("2027-10-08T12:00:00Z"));
  });

  it("acesso vigente soma 12 meses ao fim atual", () => {
    expect(calcularAccessUntilPix(new Date("2026-12-01T00:00:00Z"), agora)).toEqual(new Date("2027-12-01T00:00:00Z"));
  });

  it("29 de fevereiro vira 28 de fevereiro", () => {
    expect(somarMesesUTC(new Date("2028-02-29T10:00:00Z"), 12)).toEqual(new Date("2029-02-28T10:00:00Z"));
    expect(somarMesesUTC(new Date("2026-01-31T00:00:00Z"), 1)).toEqual(new Date("2026-02-28T00:00:00Z"));
  });
});

describe("carência", () => {
  it("primeira falha inicia 3 dias de carência", () => {
    expect(calcularCarencia(null, "past_due", "iniciar", agora)).toEqual({ graceUntil: dias(3), iniciou: true });
  });

  it("novas tentativas não estendem a carência", () => {
    expect(calcularCarencia(dias(1), "past_due", "iniciar", agora)).toEqual({ graceUntil: dias(1), iniciou: false });
    expect(calcularCarencia(dias(-1), "past_due", "iniciar", agora)).toEqual({ graceUntil: dias(-1), iniciou: false });
  });

  it("fatura paga ou assinatura em dia limpa a carência", () => {
    expect(calcularCarencia(dias(1), "past_due", "limpar", agora).graceUntil).toBeNull();
    expect(calcularCarencia(dias(1), "active", "manter", agora).graceUntil).toBeNull();
    expect(calcularCarencia(dias(1), "trialing", "iniciar", agora).graceUntil).toBeNull();
  });

  it("outros eventos mantêm a carência", () => {
    expect(calcularCarencia(dias(2), "past_due", "manter", agora)).toEqual({ graceUntil: dias(2), iniciou: false });
  });
});

describe("planejarSeguidos", () => {
  const seguidos = [
    { id: "b", status: "ATIVO" as const, createdAt: dias(-5) },
    { id: "a", status: "ATIVO" as const, createdAt: dias(-10) },
    { id: "c", status: "PAUSADO" as const, createdAt: dias(-1) },
    { id: "d", status: "ATIVO" as const, createdAt: dias(-2) },
  ];

  it("no Grátis mantém só o mais antigo ativo", () => {
    expect(planejarSeguidos(seguidos, "FREE")).toEqual({ pausar: ["b", "d"], reativar: [] });
  });

  it("no Pro reativa todos os pausados", () => {
    expect(planejarSeguidos(seguidos, "PRO")).toEqual({ pausar: [], reativar: ["c"] });
  });

  it("Grátis dentro do limite não muda nada", () => {
    expect(planejarSeguidos([seguidos[1]!], "FREE")).toEqual({ pausar: [], reativar: [] });
  });
});

describe("lembrete de renovação do Pix", () => {
  const base = { renewalReminderSentAt: null, status: null };

  it("avisa a 7 dias ou menos do fim", () => {
    expect(precisaLembretePix({ ...base, accessUntil: dias(7) }, agora)).toBe(true);
    expect(precisaLembretePix({ ...base, accessUntil: dias(1) }, agora)).toBe(true);
  });

  it("não avisa cedo demais, depois do fim, duas vezes ou com cartão ativo", () => {
    expect(precisaLembretePix({ ...base, accessUntil: dias(8) }, agora)).toBe(false);
    expect(precisaLembretePix({ ...base, accessUntil: dias(-1) }, agora)).toBe(false);
    expect(precisaLembretePix({ ...base, accessUntil: dias(3), renewalReminderSentAt: dias(-1) }, agora)).toBe(false);
    expect(precisaLembretePix({ ...base, accessUntil: dias(3), status: "active" }, agora)).toBe(false);
    expect(precisaLembretePix({ ...base, accessUntil: null }, agora)).toBe(false);
  });
});

describe("trial até o fim do Pix", () => {
  it("usa o fim do acesso Pix quando faltam mais de 48 h", () => {
    expect(trialAteFimDoPix(dias(30), agora)).toBe(Math.floor(dias(30).getTime() / 1000));
    expect(trialAteFimDoPix(dias(1), agora)).toBeNull();
    expect(trialAteFimDoPix(null, agora)).toBeNull();
  });
});

describe("preços", () => {
  it("economia do anual em reais", () => {
    expect(economiaAnualCentavos()).toBe(2990 * 12 - 23900);
    expect(mensalEquivalenteAnualCentavos()).toBe(1992);
  });
});
