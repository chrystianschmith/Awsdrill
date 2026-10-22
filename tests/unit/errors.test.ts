import { describe, expect, it } from "vitest";
import { AppError, fail, ok } from "@/lib/errors";

describe("ActionResult", () => {
  it("ok carrega os dados", () => {
    expect(ok({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
  });

  it("fail carrega mensagem, código e erros por campo", () => {
    expect(fail("E-mail inválido.", "validacao", { email: ["Informe um e-mail."] })).toEqual({
      ok: false,
      error: "E-mail inválido.",
      code: "validacao",
      fieldErrors: { email: ["Informe um e-mail."] },
    });
  });

  it("AppError tem código padrão", () => {
    const e = new AppError("Algo deu errado.");
    expect(e.code).toBe("erro");
    expect(e.name).toBe("AppError");
  });
});
