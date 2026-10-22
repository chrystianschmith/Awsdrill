import { describe, expect, it } from "vitest";
import { destinoSeguro } from "@/lib/auth/voltar";

describe("parâmetro voltar do login", () => {
  it("aceita caminhos internos", () => {
    expect(destinoSeguro("/simulados")).toBe("/simulados");
    expect(destinoSeguro("/simulados/clf-c02?modo=treino#topo")).toBe("/simulados/clf-c02?modo=treino#topo");
  });

  it("usa /hoje quando ausente ou inválido", () => {
    expect(destinoSeguro(undefined)).toBe("/hoje");
    expect(destinoSeguro("")).toBe("/hoje");
    expect(destinoSeguro(["/a"])).toBe("/hoje");
    expect(destinoSeguro(undefined, "/conta")).toBe("/conta");
  });

  it("bloqueia URLs externas e protocol-relative", () => {
    expect(destinoSeguro("https://evil.com")).toBe("/hoje");
    expect(destinoSeguro("//evil.com")).toBe("/hoje");
    expect(destinoSeguro("/\\evil.com")).toBe("/hoje");
    expect(destinoSeguro("/a//b")).toBe("/hoje");
    expect(destinoSeguro("javascript:alert(1)")).toBe("/hoje");
    expect(destinoSeguro("evil.com/hoje")).toBe("/hoje");
  });

  it("bloqueia caracteres de controle", () => {
    expect(destinoSeguro("/\t/evil.com")).toBe("/hoje");
    expect(destinoSeguro("/hoje\nSet-Cookie:x")).toBe("/hoje");
  });

  it("não volta para o próprio login", () => {
    expect(destinoSeguro("/entrar")).toBe("/hoje");
    expect(destinoSeguro("/entrar?voltar=/x")).toBe("/hoje");
  });

  it("limita o tamanho", () => {
    expect(destinoSeguro("/" + "a".repeat(600))).toBe("/hoje");
  });
});
