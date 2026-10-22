import { describe, expect, it, vi } from "vitest";
import { Coletor } from "../../../scripts/pipeline/coletor";
import { hostLocal, ipBloqueado } from "@/lib/catalogo/rede";

const PUBLICO = "52.94.236.248";
const DOCS = "https://docs.aws.amazon.com/aws-certification/latest";

function coletor(rotas: Record<string, Response | (() => Response)>, dns: Record<string, string[]> = {}) {
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    const chave = String(url);
    const r = rotas[chave];
    if (!r) return new Response("nada", { status: 404 });
    return typeof r === "function" ? r() : r.clone();
  });
  const c = new Coletor({
    contato: "contato@example.com",
    resolver: async (h) => dns[h] ?? [PUBLICO],
    fetchImpl: fetchImpl as unknown as typeof fetch,
    dormir: async () => {},
    tentativas: 1,
  });
  return { c, fetchImpl };
}

const redirect = (para: string) => () => new Response(null, { status: 302, headers: { location: para } });

describe("ipBloqueado", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "recusa %s",
    (ip) => expect(ipBloqueado(ip)).toBe(true),
  );
  it.each([PUBLICO, "8.8.8.8", "2001:4860:4860::8888"])("aceita %s", (ip) => expect(ipBloqueado(ip)).toBe(false));
  it("recusa hostnames locais", () => {
    expect(hostLocal("localhost")).toBe(true);
    expect(hostLocal("metadata.google.internal")).toBe(true);
    expect(hostLocal("docs.aws.amazon.com")).toBe(false);
  });
});

describe("Coletor: proteção contra SSRF", () => {
  it("baixa de host oficial", async () => {
    const { c } = coletor({ [`${DOCS}/guia.md`]: new Response("# Guia", { headers: { "content-type": "text/markdown; charset=utf-8" } }) });
    expect(await c.obterTexto(`${DOCS}/guia.md`)).toBe("# Guia");
  });

  it.each([
    "https://docs.aws.amazon.com.evil.example/guia.md",
    "https://evil.example/guia.md",
    "https://user:senha@docs.aws.amazon.com/guia.md",
    "https://docs.aws.amazon.com:8443/guia.md",
    "https://169.254.169.254/latest/meta-data/",
  ])("recusa %s sem nem buscar", async (url) => {
    const { c, fetchImpl } = coletor({});
    await expect(c.obter(url)).rejects.toThrow(/fora da lista/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("recusa http", async () => {
    const { c, fetchImpl } = coletor({});
    await expect(c.obter("http://docs.aws.amazon.com/guia.md")).rejects.toThrow(/Protocolo/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("recusa redirect para host fora da allowlist", async () => {
    const { c } = coletor({ [`${DOCS}/guia.md`]: redirect("https://evil.example/x.md") });
    await expect(c.obter(`${DOCS}/guia.md`)).rejects.toThrow(/fora da lista/);
  });

  it("recusa redirect para IP interno", async () => {
    const { c } = coletor({ [`${DOCS}/guia.md`]: redirect("https://169.254.169.254/latest/meta-data/") });
    await expect(c.obter(`${DOCS}/guia.md`)).rejects.toThrow(/fora da lista/);
  });

  it("recusa host oficial que resolve para IP interno", async () => {
    const { c } = coletor({}, { "docs.aws.amazon.com": ["10.0.0.5"] });
    await expect(c.obter(`${DOCS}/guia.md`)).rejects.toThrow(/Destino interno/);
  });

  it("segue até 3 redirects dentro da allowlist e para no 4º", async () => {
    const ok = coletor({
      [`${DOCS}/a`]: redirect("/aws-certification/latest/b"),
      [`${DOCS}/b`]: redirect("https://aws.amazon.com/c"),
      "https://aws.amazon.com/c": new Response("fim"),
    });
    expect(await ok.c.obterTexto(`${DOCS}/a`)).toBe("fim");

    const loop = coletor({
      [`${DOCS}/1`]: redirect("/aws-certification/latest/2"),
      [`${DOCS}/2`]: redirect("/aws-certification/latest/3"),
      [`${DOCS}/3`]: redirect("/aws-certification/latest/4"),
      [`${DOCS}/4`]: redirect("/aws-certification/latest/5"),
    });
    await expect(loop.c.obter(`${DOCS}/1`)).rejects.toThrow(/Redirects demais/);
  });

  it("recusa documento acima do limite de tamanho", async () => {
    const grande = new Uint8Array(3 * 1024 * 1024);
    const { c } = coletor({ [`${DOCS}/guia.md`]: new Response(grande) });
    await expect(c.obter(`${DOCS}/guia.md`)).rejects.toThrow(/grande demais/);
  });

  it("respeita o robots.txt", async () => {
    const { c } = coletor({ "https://docs.aws.amazon.com/robots.txt": new Response("User-agent: *\nDisallow: /aws-certification/") });
    await expect(c.obter(`${DOCS}/guia.md`)).rejects.toThrow(/robots/);
  });
});

describe("Coletor: contato no User-Agent", () => {
  it("remove a quebra de linha que vem em segredos colados", () => {
    const c = new Coletor({ contato: "contato@example.com\n" });
    expect(c.userAgent).toContain("contato: contato@example.com)");
    expect(() => new Headers({ "user-agent": c.userAgent })).not.toThrow();
  });
  it("recusa contato que não é um e-mail", () => {
    expect(() => new Coletor({ contato: "a b@c" })).toThrow("PIPELINE_CONTACT_EMAIL");
  });
});

describe("Coletor: erro de rede", () => {
  it("mostra a causa por trás de \"fetch failed\"", async () => {
    // Função simples em vez de vi.fn: no Vitest 5 um vi.fn que lança marca o teste como falho.
    const fetchImpl = async () => {
      throw new TypeError("fetch failed", { cause: { code: "ECONNRESET", message: "read ECONNRESET" } });
    };
    const c = new Coletor({
      contato: "contato@example.com",
        resolver: async () => [PUBLICO],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dormir: async () => {},
      tentativas: 1,
    });
    await expect(c.obter(`${DOCS}/guia.md`)).rejects.toThrow(/robots\.txt inacessível.*fetch failed \(ECONNRESET read ECONNRESET\)/);
  });
});
