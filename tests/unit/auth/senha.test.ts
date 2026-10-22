import { describe, expect, it } from "vitest";
import { ARGON2_OPCOES, hashSenha, verificarSenha, verificarSenhaFicticia } from "@/lib/auth/senha";

describe("hash de senha (argon2id)", () => {
  it("gera hash argon2id com os parâmetros da OWASP", async () => {
    const h = await hashSenha("estudo-diario-42");
    expect(h.startsWith("$argon2id$v=19$m=19456,t=2,p=1$")).toBe(true);
    expect(ARGON2_OPCOES).toMatchObject({ memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 });
  });

  it("verifica a senha correta e rejeita a errada", async () => {
    const h = await hashSenha("estudo-diario-42");
    expect(await verificarSenha(h, "estudo-diario-42")).toBe(true);
    expect(await verificarSenha(h, "estudo-diario-43")).toBe(false);
  });

  it("gera hashes diferentes para a mesma senha (salt)", async () => {
    expect(await hashSenha("mesma-senha-x")).not.toBe(await hashSenha("mesma-senha-x"));
  });

  it("trata hash malformado como senha errada", async () => {
    expect(await verificarSenha("nao-e-um-hash", "qualquer")).toBe(false);
  });

  it("verificação fictícia sempre falha", async () => {
    expect(await verificarSenhaFicticia("qualquer-coisa")).toBe(false);
  });
});
