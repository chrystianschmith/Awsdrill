"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { executar } from "@/lib/estudo/acao";
import { TAMANHOS_TREINO } from "./regras";
import { CHAVES } from "./schemas";
import * as simulados from "./servico";

const id = z.string().min(1).max(64);

const iniciarSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("TREINO"),
    examVersionId: id,
    quantidade: z.coerce
      .number()
      .refine((n) => (TAMANHOS_TREINO as readonly number[]).includes(n), "Escolha 10, 20 ou 30 questões."),
    domainIds: z.array(id).max(20).default([]),
  }),
  z.object({ mode: z.literal("PROVA"), examVersionId: id }),
]);

export async function iniciarSimuladoAction(input: z.input<typeof iniciarSchema>) {
  const user = await requireUser();
  return executar("simulado.iniciar", async () => {
    const r = await simulados.iniciarSimulado(user.id, iniciarSchema.parse(input));
    revalidatePath("/simulados");
    return r;
  });
}

const responderSchema = z.object({
  attemptId: id,
  questionId: id,
  selectedKeys: z.array(z.enum(CHAVES)).min(1).max(CHAVES.length),
});

export async function responderAction(input: z.input<typeof responderSchema>) {
  const user = await requireUser();
  return executar("simulado.responder", async () => {
    const d = responderSchema.parse(input);
    return simulados.responder(user.id, d.attemptId, d.questionId, d.selectedKeys);
  });
}

export async function enviarSimuladoAction(attemptId: string) {
  const user = await requireUser();
  return executar("simulado.enviar", async () => {
    await simulados.enviarSimulado(user.id, id.parse(attemptId));
    revalidatePath("/simulados");
  });
}
