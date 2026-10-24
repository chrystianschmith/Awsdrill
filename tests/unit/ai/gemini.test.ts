import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { configIA } from "@/lib/ai/config";
import { calcularCustoUsd } from "@/lib/ai/custo";
import { chamadaGemini, chaveEsgotada, deGemini, GeminiError, paraGemini } from "@/lib/ai/gemini";
import { gerarValidado } from "@/lib/ai/gerar-validado";
import { MAX_TOKENS_MATERIAL, paramsMaterial } from "@/lib/ai/prompts/material-tarefa";

const params = paramsMaterial("gemini-3.5-flash-lite", {
  exame: { codigo: "CLF-C02", nome: "AWS Certified Cloud Practitioner" },
  dominio: { codigo: "1", nome: "Conceitos de nuvem" },
  tarefa: { codigo: "1.1", nomeEn: "Define the benefits of the AWS Cloud.", nomePt: null },
  vizinhas: [],
  guiaOficial: "https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02.html",
});

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
}

const ok = (texto: string, extra: Record<string, unknown> = {}) =>
  resposta({
    candidates: [{ content: { parts: [{ text: "pensando", thought: true }, { text: texto }] }, finishReason: "STOP" }],
    usageMetadata: {
      promptTokenCount: 1000,
      candidatesTokenCount: 200,
      thoughtsTokenCount: 50,
      cachedContentTokenCount: 100,
    },
    ...extra,
  });

describe("configIA", () => {
  it("junta as chaves do Gemini em ordem, sem vazias nem repetidas", () => {
    const env = {
      GEMINI_API_KEY_3: "c",
      GEMINI_API_KEY: "a",
      GEMINI_API_KEY_2: " ",
      GEMINI_API_KEY_4: "a",
    } as unknown as NodeJS.ProcessEnv;
    expect(configIA(env)).toMatchObject({ provedor: "gemini", apiKey: "a", chavesGemini: ["a", "c"] });
    expect(configIA({ GEMINI_API_KEY_2: "b" } as unknown as NodeJS.ProcessEnv)).toMatchObject({
      apiKey: "b",
      chavesGemini: ["b"],
    });
  });
  it("prefere Gemini quando há GEMINI_API_KEY e usa os modelos grátis", () => {
    const c = configIA({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" } as unknown as NodeJS.ProcessEnv);
    expect(c).toMatchObject({
      provedor: "gemini",
      apiKey: "g",
      modeloPadrao: "gemini-3.5-flash-lite",
      modeloFallback: "gemini-3.5-flash",
    });
  });
  it("usa a Claude API só com ANTHROPIC_API_KEY ou com AI_PROVIDER=anthropic", () => {
    expect(configIA({ ANTHROPIC_API_KEY: "a" } as unknown as NodeJS.ProcessEnv)).toMatchObject({
      provedor: "anthropic",
      modeloPadrao: "claude-haiku-5-5",
    });
    expect(
      configIA({
        GEMINI_API_KEY: "g",
        ANTHROPIC_API_KEY: "a",
        AI_PROVIDER: "anthropic",
      } as unknown as NodeJS.ProcessEnv).provedor,
    ).toBe("anthropic");
  });
  it("sem chave a IA fica desligada", () => {
    expect(configIA({} as unknown as NodeJS.ProcessEnv)).toMatchObject({ provedor: null, apiKey: null });
  });
});

describe("paraGemini", () => {
  it("leva o system para systemInstruction, pede JSON e troca assistant por model", () => {
    const req = paraGemini({ ...params, messages: [...params.messages, { role: "assistant", content: "{}" }] });
    expect(req.systemInstruction?.parts[0]?.text).toContain("task statement");
    expect(req.contents.map((c) => c.role)).toEqual(["user", "model"]);
    expect(req.contents[0]?.parts[0]?.text).toContain("<tarefa>");
    expect(req.generationConfig.responseMimeType).toBe("application/json");
    expect(req.generationConfig.maxOutputTokens).toBe(MAX_TOKENS_MATERIAL * 2);
  });
});

describe("deGemini", () => {
  it("ignora partes de pensamento e converte o uso de tokens", async () => {
    const msg = deGemini(await ok('{"a":1}').json(), "gemini-3.5-flash-lite");
    expect(msg.content).toEqual([{ type: "text", text: '{"a":1}', citations: null }]);
    expect(msg.stop_reason).toBe("end_turn");
    expect(msg.usage).toMatchObject({ input_tokens: 900, output_tokens: 250, cache_read_input_tokens: 100 });
  });
  it("mapeia MAX_TOKENS e bloqueios de segurança", () => {
    expect(deGemini({ candidates: [{ finishReason: "MAX_TOKENS" }] }, "m").stop_reason).toBe("max_tokens");
    expect(deGemini({ candidates: [{ finishReason: "SAFETY" }] }, "m").stop_reason).toBe("refusal");
    expect(deGemini({ promptFeedback: { blockReason: "OTHER" } }, "m").stop_reason).toBe("refusal");
  });
});

describe("chamadaGemini", () => {
  it("envia a chave no cabeçalho (nunca na URL) e para o modelo pedido", async () => {
    const fetch = vi.fn().mockResolvedValue(ok("{}"));
    await chamadaGemini({ apiKey: "segredo", fetch })(params);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    expect(String(url)).not.toContain("segredo");
    expect(init.headers["x-goog-api-key"]).toBe("segredo");
  });
  it("repete em 429 respeitando o retryDelay e depois desiste com erro claro", async () => {
    const limite = () => resposta({ error: { message: "quota", details: [{ retryDelay: "7s" }] } }, 429);
    const dormir = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn().mockResolvedValueOnce(limite()).mockResolvedValueOnce(ok("{}"));
    await chamadaGemini({ apiKey: "k", fetch, dormir })(params);
    expect(dormir).toHaveBeenCalledWith(7_000);

    const sempre = vi.fn().mockImplementation(() => Promise.resolve(limite()));
    await expect(
      chamadaGemini({ apiKey: "k", fetch: sempre, dormir, maxTentativas: 2 })(params),
    ).rejects.toBeInstanceOf(GeminiError);
    expect(sempre).toHaveBeenCalledTimes(2);
  });
  it("troca para a próxima chave quando a cota do dia acaba e não volta à esgotada", async () => {
    const diaria = () =>
      resposta({ error: { message: "Quota exceeded for metric: ...PerDay. Please retry in 9h12m." } }, 429);
    const dormir = vi.fn().mockResolvedValue(undefined);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(diaria())
      .mockImplementation(() => Promise.resolve(ok("{}")));
    const chamar = chamadaGemini({ apiKey: "a", reservas: ["b", "c"], fetch, dormir });
    await chamar(params);
    await chamar(params);
    expect(fetch.mock.calls.map(([, init]) => init.headers["x-goog-api-key"])).toEqual(["a", "b", "b"]);
    expect(dormir).not.toHaveBeenCalled();
  });
  it("pula projeto bloqueado (403) e desiste com o erro da última chave", async () => {
    const bloqueado = () => resposta({ error: { message: "Your project has been denied access." } }, 403);
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(bloqueado()));
    await expect(chamadaGemini({ apiKey: "a", reservas: ["b"], fetch })(params)).rejects.toThrow("Gemini API 403");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("chaveEsgotada separa cota do dia de limite por minuto", () => {
    expect(chaveEsgotada(429, "Please retry in 3h2m")).toBe(true);
    expect(chaveEsgotada(429, "free_tier_requests, limit: 0, model: gemini-3.1-pro")).toBe(true);
    expect(chaveEsgotada(429, "Please retry in 30s")).toBe(false);
    expect(chaveEsgotada(400, "API key not valid")).toBe(false);
  });
  it("não repete erros definitivos (ex.: chave inválida)", async () => {
    const fetch = vi.fn().mockResolvedValue(resposta({ error: { message: "API key not valid" } }, 400));
    await expect(chamadaGemini({ apiKey: "k", fetch })(params)).rejects.toThrow("Gemini API 400: API key not valid");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("integra com gerarValidado, incluindo a rodada de correção", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(ok('{"n":"x"}')).mockResolvedValueOnce(ok('{"n":2}'));
    const r = await gerarValidado({
      chamar: chamadaGemini({ apiKey: "k", fetch }),
      params,
      schema: z.object({ n: z.number() }),
    });
    expect(r).toMatchObject({ dados: { n: 2 }, tentativas: 2 });
    const segunda = JSON.parse(fetch.mock.calls[1]![1].body as string);
    expect(segunda.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
  });
});

it("Gemini na camada gratuita não soma custo ao orçamento", () => {
  expect(calcularCustoUsd("gemini-3.5-flash-lite", { input_tokens: 1e6, output_tokens: 1e6 })).toBe(0);
});
