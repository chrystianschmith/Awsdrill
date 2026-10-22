import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { FormCadastro } from "../_components/form-cadastro";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CadastroPage() {
  if (await getCurrentUser()) redirect("/hoje");

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
        <p className="text-sm text-muted-foreground">Leva menos de um minuto. Você confirma o e-mail depois.</p>
      </div>
      <FormCadastro />
      <p className="text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-primary underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </div>
  );
}
