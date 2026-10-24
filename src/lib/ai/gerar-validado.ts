import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { ChamadaMensagem } from "./cliente";
import { resumirErroZod } from "./schemas";

/** Uso de tokens de uma chamada, para registro em AiUsageLog. */
export type UsoChamada = { model: string; usage: Anthropic.Usage };

/** A IA não produziu JSON válido nem depois das correções. */
export class ValidacaoIAError extends Error {
  constructor(
    readonly tentativas: number,
    readonly ultimoErro: string,
  ) {
    super(`A resposta da IA não passou na validação após ${tentativas} tentativa(s).`);
    this.name = "ValidacaoIAError";
  }
}

/** Texto das partes "text" da resposta (ignora blocos de raciocínio). */
export function textoDaResposta(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Extrai o objeto JSON da resposta, tolerando cercas ```json e texto em volta. */
export function extrairJson(texto: string): unknown {
  const semCerca = texto
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    return JSON.parse(semCerca);
  } catch {
    const ini = semCerca.indexOf("{");
    const fim = semCerca.lastIndexOf("}");
    if (ini >= 0 && fim > ini) return JSON.parse(semCerca.slice(ini, fim + 1));
    throw new SyntaxError("A resposta não contém um objeto JSON.");
  }
}

export type OpcoesGeracao<T> = {
  chamar: ChamadaMensagem;
  /** Requisição inicial (model, system com cache_control, max_tokens, 1ª mensagem). */
  params: Anthropic.MessageCreateParamsNonStreaming;
  schema: z.ZodType<T>;
  /** Rodadas de correção enviando o erro de validação (padrão 2). */
  maxCorrecoes?: number;
  /** Chamado após cada chamada real à API, para registrar uso e custo. */
  aoUsar?: (uso: UsoChamada) => Promise<void>;
  /** Resposta já obtida (ex.: Batch API) usada como primeira tentativa. */
  respostaInicial?: Anthropic.Message;
};

/**
 * Pede JSON à IA, valida com Zod e, se falhar, devolve o erro de validação
 * na mesma conversa pedindo a correção (até `maxCorrecoes` vezes).
 */
export async function gerarValidado<T>(o: OpcoesGeracao<T>): Promise<{ dados: T; tentativas: number; model: string }> {
  const maxCorrecoes = o.maxCorrecoes ?? 2;
  const messages: Anthropic.MessageParam[] = [...o.params.messages];
  let ultimoErro = "";

  for (let tentativa = 0; tentativa <= maxCorrecoes; tentativa++) {
    let resposta: Anthropic.Message;
    if (tentativa === 0 && o.respostaInicial) {
      resposta = o.respostaInicial;
    } else {
      resposta = await o.chamar({ ...o.params, messages: [...messages] });
      await o.aoUsar?.({ model: resposta.model || o.params.model, usage: resposta.usage });
    }

    if (resposta.stop_reason === "refusal") {
      throw new ValidacaoIAError(tentativa + 1, "A IA recusou a solicitação.");
    }

    const texto = textoDaResposta(resposta);
    let erro: string;
    if (resposta.stop_reason === "max_tokens") {
      erro = "A resposta foi cortada por exceder o limite de tamanho. Seja mais conciso e devolva o JSON completo.";
    } else {
      try {
        const parsed = o.schema.safeParse(extrairJson(texto));
        if (parsed.success)
          return { dados: parsed.data, tentativas: tentativa + 1, model: resposta.model || o.params.model };
        erro = resumirErroZod(parsed.error);
      } catch (e) {
        erro = e instanceof Error ? `JSON inválido: ${e.message}` : "JSON inválido.";
      }
    }
    ultimoErro = erro;

    // Conversa só cresce (append-only): resposta anterior + pedido de correção.
    messages.push({ role: "assistant", content: resposta.content });
    messages.push({
      role: "user",
      content: `A resposta não passou na validação:\n${erro}\n\nResponda novamente apenas com o objeto JSON completo e corrigido, sem texto antes ou depois.`,
    });
  }
  throw new ValidacaoIAError(maxCorrecoes + 1, ultimoErro);
}
