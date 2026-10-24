"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { executar } from "@/lib/estudo/acao";
import {
  adicionarCertificacao,
  editarCertificacao,
  excluirCertificacao,
  type EntradaCertificacaoInput,
} from "./servico";

const id = z.string().min(1).max(64);

export async function adicionarCertificacaoAction(input: EntradaCertificacaoInput) {
  const user = await requireUser();
  return executar("carteira.adicionar", async () => {
    await adicionarCertificacao(user.id, input);
    revalidatePath("/carteira");
  });
}

export async function editarCertificacaoAction(registro: string, input: EntradaCertificacaoInput) {
  const user = await requireUser();
  return executar("carteira.editar", async () => {
    await editarCertificacao(user.id, id.parse(registro), input);
    revalidatePath("/carteira");
  });
}

export async function excluirCertificacaoAction(registro: string) {
  const user = await requireUser();
  return executar("carteira.excluir", async () => {
    await excluirCertificacao(user.id, id.parse(registro));
    revalidatePath("/carteira");
  });
}
