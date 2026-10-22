import { describe, expect, it } from "vitest";
import { urlOficial } from "@/lib/catalogo/fontes";
import { ExameColetado } from "@/lib/catalogo/schemas";
import { EXAMES_INICIAIS } from "../../../prisma/catalogo/exames";

describe("fontes oficiais", () => {
  it("aceita só https em docs.aws.amazon.com e aws.amazon.com", () => {
    expect(urlOficial("https://docs.aws.amazon.com/aws-certification/latest/x.html")).toBe(true);
    expect(urlOficial("https://aws.amazon.com/certification/")).toBe(true);
    expect(urlOficial("http://aws.amazon.com/certification/")).toBe(false);
    expect(urlOficial("https://aws.amazon.com.evil.example/")).toBe(false);
    expect(urlOficial("https://evil.example/?u=https://aws.amazon.com")).toBe(false);
    expect(urlOficial("https://user:x@aws.amazon.com/")).toBe(false);
    expect(urlOficial("https://aws.amazon.com:8443/")).toBe(false);
    expect(urlOficial("javascript:alert(1)")).toBe(false);
    expect(urlOficial("nao é url")).toBe(false);
  });

  it("schema recusa fonte fora da allowlist e dado inválido", () => {
    const e = EXAMES_INICIAIS[0];
    expect(ExameColetado.safeParse({ ...e, fonteGuia: "https://exemplo.com/guia" }).success).toBe(false);
    expect(ExameColetado.safeParse({ ...e, notaCorte: 1200 }).success).toBe(false);
    expect(ExameColetado.safeParse({ ...e, codigo: "saa-c03" }).success).toBe(false);
    expect(ExameColetado.safeParse({ ...e, dominios: [] }).success).toBe(false);
  });
});
