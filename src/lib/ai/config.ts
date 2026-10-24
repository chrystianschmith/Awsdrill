/**
 * Configuração da IA lida direto de process.env (sem "server-only"), para
 * funcionar tanto no app quanto em scripts. Decisão do provedor: docs/adr/0001-ia-gemini-padrao.md.
 *
 * Provedor: Gemini (camada gratuita do Google AI Studio) quando há
 * GEMINI_API_KEY (ou GEMINI_API_KEY_2 a _5, em rodízio); Claude API quando só há ANTHROPIC_API_KEY. AI_PROVIDER
 * força um dos dois se as duas chaves existirem.
 */
export type ProvedorIA = "gemini" | "anthropic";

export type ConfigIA = {
  provedor: ProvedorIA | null;
  apiKey: string | null;
  /** Chaves do Gemini para rodízio (GEMINI_API_KEY e GEMINI_API_KEY_2 a _5), cada uma de um projeto do Google. */
  chavesGemini: string[];
  modeloPadrao: string;
  modeloFallback: string;
  orcamentoMensalUsd: number;
  emailAlerta: string | null;
};

const MODELOS: Record<ProvedorIA, { padrao: string; fallback: string }> = {
  gemini: { padrao: "gemini-3.5-flash-lite", fallback: "gemini-3.5-flash" },
  anthropic: { padrao: "claude-haiku-5-5", fallback: "claude-sonnet-5-5" },
};

/** Até 5 chaves do Gemini, na ordem e sem repetidas: quando a cota do dia de uma acaba, a próxima assume. */
export function chavesGemini(env: NodeJS.ProcessEnv): string[] {
  const nomes = ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4", "GEMINI_API_KEY_5"];
  return [...new Set(nomes.map((n) => env[n]?.trim()).filter((c): c is string => Boolean(c)))];
}

function escolherProvedor(env: NodeJS.ProcessEnv): { provedor: ProvedorIA; apiKey: string } | null {
  const chaves: Record<ProvedorIA, string | null> = {
    gemini: chavesGemini(env)[0] ?? null,
    anthropic: env.ANTHROPIC_API_KEY?.trim() || null,
  };
  const preferido = env.AI_PROVIDER?.trim().toLowerCase();
  const ordem: ProvedorIA[] = preferido === "anthropic" ? ["anthropic", "gemini"] : ["gemini", "anthropic"];
  for (const p of ordem) {
    const apiKey = chaves[p];
    if (apiKey) return { provedor: p, apiKey };
  }
  return null;
}

export function configIA(env: NodeJS.ProcessEnv = process.env): ConfigIA {
  const orcamento = Number(env.AI_MONTHLY_BUDGET_USD ?? "20");
  const escolhido = escolherProvedor(env);
  const modelos = MODELOS[escolhido?.provedor ?? "gemini"];
  return {
    provedor: escolhido?.provedor ?? null,
    apiKey: escolhido?.apiKey ?? null,
    chavesGemini: escolhido?.provedor === "gemini" ? chavesGemini(env) : [],
    modeloPadrao: env.AI_MODEL_DEFAULT?.trim() || modelos.padrao,
    modeloFallback: env.AI_MODEL_FALLBACK?.trim() || modelos.fallback,
    orcamentoMensalUsd: Number.isFinite(orcamento) && orcamento >= 0 ? orcamento : 20,
    emailAlerta: env.ADMIN_ALERT_EMAIL?.trim() || null,
  };
}
