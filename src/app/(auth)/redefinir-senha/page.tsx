import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { estadoTokenReset } from "@/lib/auth/fluxos";
import { FormRedefinir } from "../_components/form-redefinir";

export const metadata: Metadata = { title: "Nova senha", referrer: "no-referrer" };

const MENSAGENS = {
  inexistente: "Este link é inválido.",
  expirado: "Este link expirou. Os links valem por 30 minutos.",
  usado: "Este link já foi usado.",
} as const;

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await searchParams;
  const tokenStr = typeof token === "string" ? token : "";
  const estado = await estadoTokenReset(tokenStr);

  if (estado !== "valido") {
    return (
      <div className="grid gap-6">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Não foi possível usar este link</h1>
        </div>
        <Alert tone="warning">{MENSAGENS[estado]} Peça um novo link para redefinir a senha.</Alert>
        <Link href="/esqueci-senha" className={buttonVariants({ className: "w-full" })}>
          Pedir novo link
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Criar nova senha</h1>
        <p className="text-sm text-muted-foreground">Depois de salvar, as sessões abertas em outros dispositivos serão encerradas.</p>
      </div>
      <FormRedefinir token={tokenStr} />
    </div>
  );
}
