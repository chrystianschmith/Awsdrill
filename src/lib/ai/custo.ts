/**
 * Tabela de preços da Claude API em USD por milhão de tokens (fonte: skill
 * claude-api, tabela de modelos em cache de 2026-10-06; confira a página de
 * preços da Anthropic ao mudar de modelo). Escrita em cache = 1,25x a entrada;
 * Batch API = 50% de desconto em tudo.
 */
export type PrecoModelo = {
  entrada: number;
  saida: number;
  leituraCache: number;
  /** Preços acima de `limiteContexto` tokens de entrada (Haiku 5.5). */
  longo?: { limiteContexto: number; entrada: number; saida: number };
};

export const PRECOS: Record<string, PrecoModelo> = {
  // Gemini na camada gratuita do Google AI Studio: sem cobrança (limites diários de requisições).
  "gemini-3.5-flash-lite": { entrada: 0, saida: 0, leituraCache: 0 },
  "gemini-3.5-flash": { entrada: 0, saida: 0, leituraCache: 0 },
  "gemini-3.8-flash": { entrada: 0, saida: 0, leituraCache: 0 },
  "claude-haiku-5-5": {
    entrada: 0.1,
    saida: 0.5,
    leituraCache: 0.01,
    longo: { limiteContexto: 100_000, entrada: 0.5, saida: 2.5 },
  },
  "claude-sonnet-5-5": { entrada: 2, saida: 10, leituraCache: 0.2 },
  "claude-sonnet-5": { entrada: 2, saida: 10, leituraCache: 0.2 },
  "claude-opus-5-5": { entrada: 4, saida: 20, leituraCache: 0.2 },
  "claude-haiku-4-5": { entrada: 1, saida: 5, leituraCache: 0.1 },
  "claude-sonnet-4-6": { entrada: 3, saida: 15, leituraCache: 0.3 },
};

/** Modelo desconhecido: cobra como o mais caro da tabela (estimativa conservadora). */
const PRECO_DESCONHECIDO: PrecoModelo = { entrada: 4, saida: 20, leituraCache: 0.4 };

export const MULTIPLICADOR_ESCRITA_CACHE = 1.25;
export const DESCONTO_LOTE = 0.5;

export type UsoTokens = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export function precoDoModelo(model: string): PrecoModelo {
  return PRECOS[model] ?? PRECO_DESCONHECIDO;
}

/** Custo estimado de uma chamada em USD. */
export function calcularCustoUsd(model: string, uso: UsoTokens, opcoes: { lote?: boolean } = {}): number {
  const p = precoDoModelo(model);
  const escrita = uso.cache_creation_input_tokens ?? 0;
  const leitura = uso.cache_read_input_tokens ?? 0;
  const contexto = uso.input_tokens + escrita + leitura;
  const longo = p.longo && contexto > p.longo.limiteContexto ? p.longo : null;
  const entrada = longo?.entrada ?? p.entrada;
  const saida = longo?.saida ?? p.saida;
  const custo =
    (uso.input_tokens * entrada +
      escrita * entrada * MULTIPLICADOR_ESCRITA_CACHE +
      leitura * p.leituraCache +
      uso.output_tokens * saida) /
    1_000_000;
  return opcoes.lote ? custo * DESCONTO_LOTE : custo;
}
