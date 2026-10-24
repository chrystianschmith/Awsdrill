import { describe, expect, it } from "vitest";
import { destinoApiStripe } from "@/lib/assinaturas/stripe-destino";

describe("destinoApiStripe", () => {
  it("sem STRIPE_API_BASE usa a API real", () => {
    expect(destinoApiStripe({})).toBeNull();
  });
  it("aponta para o mock local", () => {
    expect(destinoApiStripe({ STRIPE_API_BASE: "http://localhost:12111" })).toEqual({
      host: "localhost",
      port: 12111,
      protocol: "http",
    });
  });
  it("porta padrão por protocolo", () => {
    expect(destinoApiStripe({ STRIPE_API_BASE: "https://stripe.local" })).toEqual({
      host: "stripe.local",
      port: 443,
      protocol: "https",
    });
  });
  it("ignorado num deploy de produção", () => {
    expect(destinoApiStripe({ STRIPE_API_BASE: "http://localhost:12111", VERCEL_ENV: "production" })).toBeNull();
  });
});
