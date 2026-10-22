import type { Metadata } from "next";
import Link from "next/link";
import { FormEsqueci } from "../_components/form-esqueci";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function EsqueciSenhaPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Esqueci minha senha</h1>
        <p className="text-sm text-muted-foreground">
          Informe o e-mail da conta. Enviaremos um link válido por 30 minutos para criar uma nova senha.
        </p>
      </div>
      <FormEsqueci />
      <Link href="/entrar" className="w-fit text-sm text-primary underline underline-offset-4">
        Voltar para entrar
      </Link>
    </div>
  );
}
