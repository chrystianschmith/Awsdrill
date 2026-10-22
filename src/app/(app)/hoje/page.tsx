import type { Metadata } from "next";
import Link from "next/link";
import { AvisoEmailNaoConfirmado } from "@/lib/auth/components";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Hoje" };

/** Painel do dia. O plano de estudo e a prontidão entram nas etapas 4 a 6. */
export default async function HojePage() {
  const user = await requireUser();
  const primeiroNome = user.name.split(/\s+/)[0] ?? user.name;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {primeiroNome}</h1>
        <p className="text-sm text-muted-foreground">
          Em breve aqui: a meta do dia, as revisões e o próximo simulado da certificação que você escolher.
        </p>
      </div>
      <AvisoEmailNaoConfirmado />
      <p className="text-sm text-muted-foreground">
        Enquanto isso, confira seus dados e preferências de e-mail em{" "}
        <Link href="/conta" className="text-primary underline-offset-4 hover:underline">
          Conta
        </Link>
        .
      </p>
    </div>
  );
}
