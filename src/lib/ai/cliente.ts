import Anthropic from "@anthropic-ai/sdk";
import { configIA } from "./config";
import { chamadaGemini } from "./gemini";

/** Sem GEMINI_API_KEY nem ANTHROPIC_API_KEY a IA fica desligada (dev local, CI, testes). */
export class IaIndisponivelError extends Error {
  constructor() {
    super("A geração com IA não está disponível no momento.");
    this.name = "IaIndisponivelError";
  }
}

let cliente: Anthropic | null = null;

export function iaDisponivel(): boolean {
  return configIA().apiKey !== null;
}

/** Cliente criado sob demanda e só quando há chave configurada. */
export function getAnthropic(): Anthropic {
  const { provedor, apiKey } = configIA();
  if (provedor !== "anthropic" || !apiKey) throw new IaIndisponivelError();
  cliente ??= new Anthropic({ apiKey, maxRetries: 3, timeout: 5 * 60_000 });
  return cliente;
}

/** Função que envia uma requisição à Messages API (injetável nos testes). */
export type ChamadaMensagem = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

let gemini: ChamadaMensagem | null = null;

export function chamadaPadrao(): ChamadaMensagem {
  const { provedor, apiKey, chavesGemini } = configIA();
  // Uma instância por processo: o rodízio lembra qual chave do Gemini ainda tem cota.
  if (provedor === "gemini" && apiKey) return (gemini ??= chamadaGemini({ apiKey, reservas: chavesGemini.slice(1) }));
  const c = getAnthropic();
  return (params) => c.messages.create(params);
}
