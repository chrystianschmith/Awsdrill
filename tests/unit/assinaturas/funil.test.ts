import { describe, expect, it } from "vitest";
import { planoDaUrl, urlEntrarComPlano, urlIniciarCheckout } from "@/lib/assinaturas/funil";
import { destinoSeguro } from "@/lib/auth/voltar";

describe("funil de venda", () => {
  it("lê o plano da URL sem diferenciar maiúsculas", () => {
    expect(planoDaUrl("anual")).toBe("ANUAL");
    expect(planoDaUrl("MENSAL")).toBe("MENSAL");
    expect(planoDaUrl("anual_pix")).toBe("ANUAL_PIX");
  });

  it("recusa planos desconhecidos e tipos errados", () => {
    expect(planoDaUrl("vitalicio")).toBeNull();
    expect(planoDaUrl(undefined)).toBeNull();
    expect(planoDaUrl(["anual"])).toBeNull();
  });

  it("monta URLs internas que passam no filtro de redirect seguro", () => {
    expect(urlIniciarCheckout("ANUAL")).toBe("/checkout/iniciar?plano=anual");
    expect(urlEntrarComPlano("MENSAL")).toBe("/entrar?voltar=%2Fcheckout%2Finiciar%3Fplano%3Dmensal");
    expect(destinoSeguro(urlIniciarCheckout("ANUAL_PIX"))).toBe("/checkout/iniciar?plano=anual_pix");
  });
});
