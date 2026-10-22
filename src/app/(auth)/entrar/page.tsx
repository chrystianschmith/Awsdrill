import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { getCurrentUser } from "@/lib/auth/session";
import { destinoSeguro } from "@/lib/auth/voltar";
import { FormEntrar } from "../_components/form-entrar";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const voltarBruto = typeof sp.voltar === "string" ? sp.voltar : undefined;
  const destino = destinoSeguro(voltarBruto);
  if (await getCurrentUser()) redirect(destino);
  const voltar = destino === "/hoje" ? undefined : destino;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-sm text-muted-foreground">Continue de onde parou.</p>
      </div>
      {sp.redefinida === "1" ? <Alert tone="success">Senha alterada. Entre com a nova senha.</Alert> : null}
      <FormEntrar voltar={voltar} />
      <div className="grid gap-2 text-sm">
        <Link href="/esqueci-senha" className="w-fit text-primary underline-offset-4 hover:underline">
          Esqueci minha senha
        </Link>
        <p className="text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="text-primary underline-offset-4 hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
