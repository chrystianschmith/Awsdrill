import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "@/lib/log";

afterEach(() => vi.restoreAllMocks());

describe("log", () => {
  it("remove campos sensíveis", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    log("info", "teste", { senha: "x", tokenHash: "y", authorization: "z", usuario: "u1" });
    const linha = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(linha).toMatchObject({ nivel: "info", evento: "teste", senha: "[removido]", tokenHash: "[removido]", authorization: "[removido]", usuario: "u1" });
  });

  it("usa console.error para erro e console.warn para aviso", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    log("error", "falhou");
    log("warn", "atencao");
    expect(err).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
  });
});
