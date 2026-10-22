import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRIVADAS, proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

function req(caminho: string, cookie?: string) {
  return new NextRequest(new URL(caminho, "http://localhost:3000"), {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy: headers de segurança", () => {
  it("envia CSP com nonce e os headers obrigatórios", () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = proxy(req("/"));
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
  });

  it("gera um nonce diferente por requisição", () => {
    const a = proxy(req("/")).headers.get("Content-Security-Policy");
    const b = proxy(req("/")).headers.get("Content-Security-Policy");
    expect(a).not.toBe(b);
  });

  it("não envia HSTS fora de produção", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(proxy(req("/")).headers.get("Strict-Transport-Security")).toBeNull();
  });
});

describe("proxy: rotas privadas", () => {
  it.each(PRIVADAS)("%s sem cookie de sessão redireciona para /entrar", (rota) => {
    const res = proxy(req(`${rota}?x=1`));
    expect(res.status).toBe(307);
    const destino = new URL(res.headers.get("location") ?? "");
    expect(destino.pathname).toBe("/entrar");
    expect(destino.searchParams.get("voltar")).toBe(`${rota}?x=1`);
  });

  it("não confunde prefixo parecido com rota privada", () => {
    expect(proxy(req("/hojeemdia")).status).toBe(200);
  });

  it("com cookie segue (a sessão é revalidada no servidor)", () => {
    expect(proxy(req("/hoje", "tr_sessao=abc")).status).toBe(200);
  });
});

describe("cookie de sessão", () => {
  it("o proxy e a sessão usam o mesmo nome", async () => {
    const { SESSION_COOKIE } = await import("@/lib/auth/cookie");
    expect(SESSION_COOKIE).toBe("tr_sessao");
  });
});
