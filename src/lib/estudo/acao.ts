import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { AppError, fail, ok, type ActionResult } from "@/lib/errors";
import { log } from "@/lib/log";

/** Cliente ou transação: os serviços aceitam os dois. */
export type Executor = PrismaClient | Prisma.TransactionClient;

/**
 * Executa a regra de uma Server Action e converte erros conhecidos em
 * ActionResult com mensagem em pt-BR.
 */
export async function executar<T>(evento: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AppError) return fail(e.message, e.code);
    if (e instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const campo = issue.path.join(".") || "_";
        (fieldErrors[campo] ??= []).push(issue.message);
      }
      return fail("Confira os campos destacados.", "validacao", fieldErrors);
    }
    log("error", `${evento}.falhou`, { erro: e instanceof Error ? e.message : String(e) });
    return fail("Não foi possível concluir agora. Tente novamente.", "erro");
  }
}

/** Erro de conflito de unicidade do Prisma (P2002). */
export function ehViolacaoUnica(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";
}
