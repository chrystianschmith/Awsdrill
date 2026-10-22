import { describe, expect, it } from "vitest";
import {
  avaliarToken,
  expiraEm,
  formatoTokenValido,
  gerarToken,
  hashesIguais,
  hashToken,
  TTL_CONFIRMACAO_MS,
  TTL_RESET_MS,
} from "@/lib/auth/tokens";

describe("tokens", () => {
  it("gera 32 bytes em base64url, sempre diferentes", () => {
    const a = gerarToken();
    const b = gerarToken();
    expect(a).toHaveLength(43);
    expect(a).not.toBe(b);
    expect(formatoTokenValido(a)).toBe(true);
  });

  it("guarda só o hash SHA-256 (hex, determinístico)", () => {
    const t = gerarToken();
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("compara hashes em tempo constante", () => {
    expect(hashesIguais("abc", "abc")).toBe(true);
    expect(hashesIguais("abc", "abd")).toBe(false);
    expect(hashesIguais("abc", "abcd")).toBe(false);
  });

  it("rejeita formatos inválidos", () => {
    expect(formatoTokenValido("")).toBe(false);
    expect(formatoTokenValido("a".repeat(42))).toBe(false);
    expect(formatoTokenValido("a".repeat(42) + "=")).toBe(false);
    expect(formatoTokenValido(undefined)).toBe(false);
  });

  it("validades: confirmação 24h e reset 30 min", () => {
    const agora = new Date("2026-10-08T12:00:00Z");
    expect(expiraEm(TTL_CONFIRMACAO_MS, agora).toISOString()).toBe("2026-10-09T12:00:00.000Z");
    expect(expiraEm(TTL_RESET_MS, agora).toISOString()).toBe("2026-10-08T12:30:00.000Z");
  });
});

describe("avaliarToken", () => {
  const agora = new Date("2026-10-08T12:00:00Z");
  const expiresAt = new Date("2026-10-08T12:30:00Z");

  it("inexistente", () => {
    expect(avaliarToken(null, agora)).toBe("inexistente");
    expect(avaliarToken(undefined, agora)).toBe("inexistente");
  });

  it("válido antes de expirar", () => {
    expect(avaliarToken({ expiresAt, usedAt: null }, agora)).toBe("valido");
    expect(avaliarToken({ expiresAt, usedAt: null }, new Date("2026-10-08T12:29:59Z"))).toBe("valido");
  });

  it("expirado no instante da expiração e depois", () => {
    expect(avaliarToken({ expiresAt, usedAt: null }, expiresAt)).toBe("expirado");
    expect(avaliarToken({ expiresAt, usedAt: null }, new Date("2026-10-08T13:00:00Z"))).toBe("expirado");
  });

  it("uso único: usado tem prioridade sobre expirado", () => {
    expect(avaliarToken({ expiresAt, usedAt: agora }, agora)).toBe("usado");
    expect(avaliarToken({ expiresAt, usedAt: agora }, new Date("2026-10-09T00:00:00Z"))).toBe("usado");
  });
});
