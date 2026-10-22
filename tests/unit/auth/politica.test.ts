import { describe, expect, it } from "vitest";
import { normalizarEmail, validarSenha } from "@/lib/auth/politica";
import {
  cadastroSchema,
  excluirContaSchema,
  loginSchema,
  redefinirSchema,
  trocarSenhaSchema,
} from "@/lib/auth/schemas";
import { senhaComum } from "@/lib/auth/senhas-comuns";

describe("política de senha", () => {
  it("exige pelo menos 8 caracteres", () => {
    expect(validarSenha("abc1234")).toMatch(/8 caracteres/);
    expect(validarSenha("cavalo-azul-9")).toBeNull();
  });

  it("limita o tamanho máximo", () => {
    expect(validarSenha("a".repeat(129))).toMatch(/no máximo/);
  });

  it("rejeita senhas comuns sem diferenciar maiúsculas", () => {
    expect(validarSenha("12345678")).toMatch(/comum/);
    expect(validarSenha("Password1")).toMatch(/comum/);
    expect(validarSenha("CONCURSO123")).toMatch(/comum/);
    expect(validarSenha("Aws12345")).toMatch(/comum/);
    expect(senhaComum("  senha123 ")).toBe(true);
  });

  it("rejeita senha só com espaços", () => {
    expect(validarSenha("          ")).toMatch(/espaços/);
  });

  it("rejeita senha igual ao e-mail", () => {
    expect(validarSenha("ana.silva", { email: "Ana.Silva@exemplo.com" })).toMatch(/e-mail/);
    expect(validarSenha("ana@exemplo.com", { email: "ana@exemplo.com" })).toMatch(/e-mail/);
  });
});

describe("normalização de e-mail", () => {
  it("aplica trim e minúsculas", () => {
    expect(normalizarEmail("  Ana.Silva@Exemplo.COM ")).toBe("ana.silva@exemplo.com");
  });

  it("normaliza Unicode para NFC", () => {
    const decomposto = "josé@exemplo.com";
    expect(normalizarEmail(decomposto)).toBe("josé@exemplo.com");
  });
});

describe("schemas", () => {
  const valido = {
    nome: "Ana Silva",
    email: " ANA@exemplo.com ",
    senha: "cavalo-azul-9",
    aceiteTermos: true,
  };

  it("cadastro normaliza o e-mail e descarta campos desconhecidos", () => {
    const r = cadastroSchema.parse({ ...valido, role: "ADMIN", userId: "outro" });
    expect(r.email).toBe("ana@exemplo.com");
    expect(r).not.toHaveProperty("role");
    expect(r).not.toHaveProperty("userId");
  });

  it("cadastro exige aceite dos termos e e-mail válido", () => {
    expect(cadastroSchema.safeParse({ ...valido, aceiteTermos: false }).success).toBe(false);
    expect(cadastroSchema.safeParse({ ...valido, email: "ana@" }).success).toBe(false);
  });

  it("cadastro rejeita senha igual ao e-mail", () => {
    const r = cadastroSchema.safeParse({ ...valido, email: "cavalo.azul.9@exemplo.com", senha: "cavalo.azul.9" });
    expect(r.success).toBe(false);
  });

  it("login não aplica política de senha (só exige preenchimento)", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", senha: "123" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.com", senha: "" }).success).toBe(false);
  });

  it("redefinir exige token no formato e senhas iguais", () => {
    const token = "A".repeat(43);
    expect(redefinirSchema.safeParse({ token, senha: "cavalo-azul-9", confirmacao: "cavalo-azul-9" }).success).toBe(
      true,
    );
    expect(redefinirSchema.safeParse({ token, senha: "cavalo-azul-9", confirmacao: "outra" }).success).toBe(false);
    expect(
      redefinirSchema.safeParse({ token: "curto", senha: "cavalo-azul-9", confirmacao: "cavalo-azul-9" }).success,
    ).toBe(false);
  });

  it("troca de senha exige nova diferente da atual", () => {
    const r = trocarSenhaSchema.safeParse({
      senhaAtual: "cavalo-azul-9",
      novaSenha: "cavalo-azul-9",
      confirmacao: "cavalo-azul-9",
    });
    expect(r.success).toBe(false);
  });

  it("exclusão exige digitar EXCLUIR", () => {
    expect(excluirContaSchema.safeParse({ senha: "x", confirmacao: "excluir" }).success).toBe(true);
    expect(excluirContaSchema.safeParse({ senha: "x", confirmacao: "sim" }).success).toBe(false);
  });
});
