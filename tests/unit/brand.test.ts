import { describe, expect, it } from "vitest";
import { BRAND } from "@/lib/brand";

// Nome com "AWS" por decisão do dono do produto (ADR 0010); nenhuma afiliação é alegada.
describe("marca", () => {
  it("logo monta o nome a partir das partes", () => {
    expect(BRAND.partes.join(" ")).toBe(BRAND.name);
  });

  it("não cita a Amazon nem alega afiliação", () => {
    expect(`${BRAND.name} ${BRAND.tagline}`).not.toMatch(/amazon|parceir|afiliad|endossad/i);
  });

  it("não alega certificação oficial nem promete aprovação", () => {
    expect(BRAND.tagline).not.toMatch(/oficial|certified|aprovação garantida|garant/i);
  });
});
