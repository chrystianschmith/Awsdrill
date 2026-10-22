import { describe, expect, it } from "vitest";
import { cronAutorizado } from "@/lib/cron";

const req = (authorization?: string) =>
  new Request("http://localhost/api/cron/limpeza", { headers: authorization ? { authorization } : {} });

describe("cronAutorizado", () => {
  const segredo = "s".repeat(32);

  it("aceita só o Bearer com o segredo exato", () => {
    expect(cronAutorizado(req(`Bearer ${segredo}`), segredo)).toBe(true);
    expect(cronAutorizado(req(`Bearer ${segredo}x`), segredo)).toBe(false);
    expect(cronAutorizado(req(segredo), segredo)).toBe(false);
    expect(cronAutorizado(req(), segredo)).toBe(false);
  });

  it("sem segredo configurado, recusa sempre", () => {
    expect(cronAutorizado(req("Bearer "), undefined)).toBe(false);
    expect(cronAutorizado(req("Bearer "), "")).toBe(false);
  });
});
