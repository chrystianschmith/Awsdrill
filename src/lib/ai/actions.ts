"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { executar } from "@/lib/estudo/acao";
import { gerarMaterial, reportarErro, type EntradaReport } from "./servico-material";

const id = z.string().min(1).max(64);

export async function gerarMaterialAction(topicId: string) {
  const user = await requireUser();
  return executar("material.gerar", async () => {
    const r = await gerarMaterial(user.id, id.parse(topicId));
    if (r.status === "pronto") revalidatePath(`/material/${topicId}`);
    return r;
  });
}

export async function reportarErroAction(input: z.input<typeof EntradaReport>) {
  const user = await requireUser();
  return executar("material.reportar", async () => {
    const r = await reportarErro(user.id, input);
    if (r.despublicado) revalidatePath(`/material/${input.topicId}`);
    return r;
  });
}
