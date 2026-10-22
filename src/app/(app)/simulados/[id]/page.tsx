import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { obterSimulado } from "@/lib/simulados/servico";
import { ExecutarSimulado } from "@/components/simulados/executar-simulado";

export const metadata: Metadata = { title: "Simulado" };

export default async function SimuladoPage({ params }: PageProps<"/simulados/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const simulado = await obterSimulado(user.id, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === "nao_encontrado") notFound();
    throw e;
  });
  if (simulado.status !== "IN_PROGRESS") redirect(`/simulados/${id}/relatorio`);
  return (
    <div className="grid gap-4">
      <h1 className="sr-only">Simulado {simulado.examCode}</h1>
      <ExecutarSimulado simulado={simulado} />
    </div>
  );
}
