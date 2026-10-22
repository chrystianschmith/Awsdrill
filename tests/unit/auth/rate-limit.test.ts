import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

const { chaveLimite, dentroDoLimite, inicioJanela, LIMITES, RateLimitError } = await import("@/lib/auth/rate-limit");

describe("rate limit: janela fixa", () => {
  const quinzeMin = 15 * 60_000;

  it("alinha o início da janela ao múltiplo do tamanho", () => {
    const t = Date.parse("2026-10-08T12:07:30Z");
    expect(inicioJanela(t, quinzeMin).toISOString()).toBe("2026-10-08T12:00:00.000Z");
    expect(inicioJanela(Date.parse("2026-10-08T12:15:00Z"), quinzeMin).toISOString()).toBe("2026-10-08T12:15:00.000Z");
    expect(inicioJanela(Date.parse("2026-10-08T12:14:59.999Z"), quinzeMin).toISOString()).toBe(
      "2026-10-08T12:00:00.000Z",
    );
  });

  it("tentativas na mesma janela compartilham a chave", () => {
    const a = inicioJanela(Date.parse("2026-10-08T12:01:00Z"), quinzeMin);
    const b = inicioJanela(Date.parse("2026-10-08T12:14:00Z"), quinzeMin);
    expect(a.getTime()).toBe(b.getTime());
  });

  it("login: 5 por e-mail e 20 por IP a cada 15 min", () => {
    expect(LIMITES.loginEmail).toEqual({ max: 5, janelaMs: quinzeMin });
    expect(LIMITES.loginIp).toEqual({ max: 20, janelaMs: quinzeMin });
    expect(dentroDoLimite(5, LIMITES.loginEmail)).toBe(true);
    expect(dentroDoLimite(6, LIMITES.loginEmail)).toBe(false);
    expect(dentroDoLimite(20, LIMITES.loginIp)).toBe(true);
    expect(dentroDoLimite(21, LIMITES.loginIp)).toBe(false);
  });

  it("esqueci senha: 3 por hora por e-mail", () => {
    expect(LIMITES.resetEmail).toEqual({ max: 3, janelaMs: 60 * 60_000 });
    expect(dentroDoLimite(3, LIMITES.resetEmail)).toBe(true);
    expect(dentroDoLimite(4, LIMITES.resetEmail)).toBe(false);
  });

  it("chave combina escopo e identificador", () => {
    expect(chaveLimite("login:email", "ana@exemplo.com")).toBe("login:email:ana@exemplo.com");
  });

  it("erro de limite tem mensagem amigável", () => {
    expect(new RateLimitError().message).toMatch(/Aguarde alguns minutos/);
  });
});
