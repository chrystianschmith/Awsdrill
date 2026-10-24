import type { PrismaClient } from "@/generated/prisma/client";
import { calcularCustoUsd, type UsoTokens } from "./custo";

export type PropositoIA = "material";

export type RegistroUso = {
  purpose: PropositoIA;
  model: string;
  usage: UsoTokens;
  promptVersion: string;
  lote?: boolean;
};

/** Grava uma chamada em AiUsageLog e devolve o custo estimado em USD. */
export async function registrarUsoIA(db: Pick<PrismaClient, "aiUsageLog">, r: RegistroUso): Promise<number> {
  const costUsd = calcularCustoUsd(r.model, r.usage, { lote: r.lote });
  await db.aiUsageLog.create({
    data: {
      purpose: r.purpose,
      model: r.model,
      inputTokens: r.usage.input_tokens + (r.usage.cache_creation_input_tokens ?? 0),
      outputTokens: r.usage.output_tokens,
      cachedTokens: r.usage.cache_read_input_tokens ?? 0,
      costUsd,
      promptVersion: r.promptVersion,
    },
  });
  return costUsd;
}
