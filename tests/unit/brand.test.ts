import { describe, expect, it } from "vitest";
import { BRAND } from "@/lib/brand";

// Regra do produto: "AWS" não entra no nome, no domínio nem no logo; nenhuma afiliação é alegada.
describe("marca", () => {
  it("não usa AWS nem Amazon no nome", () => {
    expect(BRAND.name).not.toMatch(/aws|amazon/i);
    expect(BRAND.tagline).not.toMatch(/aws|amazon/i);
  });

  it("não alega certificação oficial nem promete aprovação", () => {
    expect(BRAND.tagline).not.toMatch(/oficial|certified|aprovação garantida|garant/i);
  });
});
