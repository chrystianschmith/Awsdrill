import type Anthropic from "@anthropic-ai/sdk";
import type { ChamadaMensagem } from "./cliente";

/**
 * Adaptador da Gemini API (Google AI Studio, camada gratuita) para o mesmo
 * formato da Messages API usado no resto do código. Assim prompts, validação
 * com Zod, correções e registro de uso continuam iguais para os dois provedores.
 *
 * Camada gratuita: o Google pode usar entradas e saídas para melhorar os
 * modelos. Só enviamos texto público (o catálogo de exames), nunca dados de usuário.
 */
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
/** Teto de saída dos modelos Flash; o pensamento interno também conta nesse limite. */
const MAX_SAIDA_GEMINI = 65_536;

type ParteGemini = { text?: string; thought?: boolean };
type ConteudoGemini = { role: "user" | "model"; parts: ParteGemini[] };

export type RequisicaoGemini = {
  systemInstruction?: { parts: { text: string }[] };
  contents: ConteudoGemini[];
  generationConfig: { maxOutputTokens: number; responseMimeType: "application/json" };
};

export type RespostaGemini = {
  candidates?: { content?: { parts?: ParteGemini[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  modelVersion?: string;
  responseId?: string;
};

function textoDosBlocos(content: Anthropic.MessageParam["content"] | Anthropic.MessageCreateParams["system"]): string {
  if (content === undefined) return "";
  if (typeof content === "string") return content;
  return content
    .map((b) => {
      if (b.type === "text") return b.text;
      if (b.type === "thinking" || b.type === "redacted_thinking") return "";
      throw new Error(`Bloco "${b.type}" não é suportado pelo adaptador Gemini.`);
    })
    .join("");
}

/** Converte a requisição da Messages API para o corpo do generateContent. */
export function paraGemini(params: Anthropic.MessageCreateParamsNonStreaming): RequisicaoGemini {
  const system = textoDosBlocos(params.system);
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: params.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: textoDosBlocos(m.content) }],
    })),
    generationConfig: {
      // Folga para o pensamento interno, que consome o mesmo limite de saída.
      maxOutputTokens: Math.min(params.max_tokens * 2, MAX_SAIDA_GEMINI),
      responseMimeType: "application/json",
    },
  };
}

const MOTIVOS_RECUSA = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"]);

function motivoDeParada(r: RespostaGemini): Anthropic.Message["stop_reason"] {
  if (r.promptFeedback?.blockReason) return "refusal";
  const motivo = r.candidates?.[0]?.finishReason;
  if (motivo === "MAX_TOKENS") return "max_tokens";
  if (motivo && MOTIVOS_RECUSA.has(motivo)) return "refusal";
  return "end_turn";
}

/** Converte a resposta do generateContent para o formato de Message. */
export function deGemini(r: RespostaGemini, model: string): Anthropic.Message {
  const texto = (r.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  const u = r.usageMetadata ?? {};
  const cache = u.cachedContentTokenCount ?? 0;
  const mensagem = {
    id: r.responseId ?? "gemini",
    type: "message",
    role: "assistant",
    model,
    content: texto ? [{ type: "text", text: texto, citations: null }] : [],
    stop_reason: motivoDeParada(r),
    stop_sequence: null,
    usage: {
      input_tokens: Math.max(0, (u.promptTokenCount ?? 0) - cache),
      output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
      cache_read_input_tokens: cache,
      cache_creation_input_tokens: 0,
    },
  };
  return mensagem as unknown as Anthropic.Message;
}

export class GeminiError extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(`Gemini API ${status}: ${mensagem}`);
    this.name = "GeminiError";
  }
}

/** Espera sugerida pelo erro 429 ("retryDelay": "30s"), limitada a 60 s. */
function esperaSugeridaMs(corpo: unknown): number | null {
  const detalhes = (corpo as { error?: { details?: { retryDelay?: string }[] } })?.error?.details ?? [];
  for (const d of detalhes) {
    const m = d.retryDelay?.match(/^(\d+(?:\.\d+)?)s$/);
    if (m) return Math.min(Number(m[1]) * 1000, 60_000);
  }
  return null;
}

const STATUS_TRANSITORIOS = new Set([429, 500, 502, 503, 504]);

/**
 * Erro que não passa com espera nesta chave, mas pode passar com a chave de outro projeto do Google:
 * cota do dia esgotada, cota zero no plano grátis (limit: 0) ou projeto bloqueado (403).
 */
export function chaveEsgotada(status: number, mensagem: string): boolean {
  if (status === 403) return true;
  return status === 429 && /retry in \d+h|per ?day|limit: 0\b/i.test(mensagem);
}

export type OpcoesGemini = {
  apiKey: string;
  /** Chaves extras (outros projetos do Google), usadas em ordem quando a atual esgota a cota do dia. */
  reservas?: string[];
  fetch?: typeof fetch;
  dormir?: (ms: number) => Promise<void>;
  /** Tentativas por chamada em erros transitórios (padrão 5). */
  maxTentativas?: number;
  timeoutMs?: number;
};

/** Chamada à Gemini API com a mesma assinatura usada para a Claude API. */
export function chamadaGemini(o: OpcoesGemini): ChamadaMensagem {
  const fazer = o.fetch ?? fetch;
  const dormir = o.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxTentativas = o.maxTentativas ?? 5;
  const chaves = [o.apiKey, ...(o.reservas ?? []).filter((c) => c !== o.apiKey)];
  // A chave atual vale para as próximas chamadas: uma chave esgotada não é tentada de novo a cada tópico.
  let atual = 0;

  return async (params) => {
    const corpo = JSON.stringify(paraGemini(params));
    for (let tentativa = 1; ; tentativa++) {
      const res = await fazer(`${BASE_URL}/${encodeURIComponent(params.model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": chaves[atual]! },
        body: corpo,
        signal: AbortSignal.timeout(o.timeoutMs ?? 5 * 60_000),
      });
      const json: unknown = await res.json().catch(() => null);
      if (res.ok) return deGemini(json as RespostaGemini, params.model);
      const msg = (json as { error?: { message?: string } })?.error?.message ?? res.statusText;

      if (atual < chaves.length - 1 && chaveEsgotada(res.status, msg)) {
        atual++;
        console.warn(
          `Gemini: chave ${atual} sem cota (${res.status}); seguindo com a chave ${atual + 1} de ${chaves.length}.`,
        );
        tentativa = 0;
        continue;
      }

      if (STATUS_TRANSITORIOS.has(res.status) && tentativa < maxTentativas) {
        // Sobrecarga do Gemini ("high demand") costuma passar em segundos: 2, 4, 8 e 16 s.
        await dormir(esperaSugeridaMs(json) ?? Math.min(2_000 * 2 ** (tentativa - 1), 30_000));
        continue;
      }
      throw new GeminiError(res.status, msg);
    }
  };
}
