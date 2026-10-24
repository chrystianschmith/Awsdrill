import { describe, expect, it } from "vitest";
import { ENTITLEMENTS, resolvePlan, resolvePlanForUser } from "@/lib/assinaturas/entitlements";

const agora = new Date("2026-10-08T12:00:00Z");
const depois = new Date("2026-10-10T12:00:00Z");
const antes = new Date("2026-10-07T12:00:00Z");
const base = { graceUntil: null, accessUntil: null };

describe("resolvePlan", () => {
  it.each([
    ["trialing", "PRO"],
    ["active", "PRO"],
    ["unpaid", "FREE"],
    ["canceled", "FREE"],
    ["incomplete_expired", "FREE"],
  ])("status %s → %s", (status, plano) => {
    expect(resolvePlan({ ...base, status }, agora).plan).toBe(plano);
  });

  it("sem assinatura é Grátis", () => {
    expect(resolvePlan(null, agora).plan).toBe("FREE");
  });

  it("admin é Pro mesmo sem assinatura; usuário comum segue a assinatura", () => {
    expect(resolvePlanForUser("ADMIN", null, agora)).toEqual({ plan: "PRO", paymentPending: false });
    expect(resolvePlanForUser("USER", null, agora).plan).toBe("FREE");
    expect(resolvePlanForUser("USER", { ...base, status: "active" }, agora).plan).toBe("PRO");
  });

  it("past_due dentro da carência é Pro com aviso", () => {
    expect(resolvePlan({ ...base, status: "past_due", graceUntil: depois }, agora)).toEqual({
      plan: "PRO",
      paymentPending: true,
    });
  });

  it("past_due com carência vencida é Grátis", () => {
    expect(resolvePlan({ ...base, status: "past_due", graceUntil: antes }, agora).plan).toBe("FREE");
  });

  it("Pix anual com acesso futuro é Pro", () => {
    expect(resolvePlan({ status: null, graceUntil: null, accessUntil: depois }, agora).plan).toBe("PRO");
    expect(resolvePlan({ status: null, graceUntil: null, accessUntil: antes }, agora).plan).toBe("FREE");
  });

  it("os dois planos têm as mesmas chaves", () => {
    expect(Object.keys(ENTITLEMENTS.FREE).sort()).toEqual(Object.keys(ENTITLEMENTS.PRO).sort());
  });
});

describe("divisão Grátis × Pro", () => {
  it("o Grátis segue um exame, treina com limite semanal e não tem os recursos Pro", () => {
    expect(ENTITLEMENTS.FREE.maxExamesSeguidos).toBe(1);
    expect(Number.isFinite(ENTITLEMENTS.FREE.treinosPorSemana)).toBe(true);
    const booleanos = Object.entries(ENTITLEMENTS.FREE).filter(([, v]) => typeof v === "boolean");
    expect(booleanos.every(([, v]) => v === false)).toBe(true);
  });

  it("o Pro libera tudo e não tem limite", () => {
    for (const v of Object.values(ENTITLEMENTS.PRO)) expect(v === true || v === Infinity).toBe(true);
  });
});
