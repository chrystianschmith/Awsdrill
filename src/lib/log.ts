type Nivel = "debug" | "info" | "warn" | "error";

const SENSIVEIS = /senha|password|token|hash|secret|authorization|cookie/i;

function limpar(dados: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(dados)) {
    saida[chave] = SENSIVEIS.test(chave) ? "[removido]" : valor;
  }
  return saida;
}

/** Log estruturado em JSON, sem dados sensíveis. */
export function log(nivel: Nivel, evento: string, dados: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "test" && nivel === "debug") return;
  const linha = JSON.stringify({ nivel, evento, ts: new Date().toISOString(), ...limpar(dados) });
  if (nivel === "error") console.error(linha);
  else if (nivel === "warn") console.warn(linha);
  else console.info(linha);
}
