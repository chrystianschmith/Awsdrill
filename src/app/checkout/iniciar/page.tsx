import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/session";
import { planoDaUrl, urlEntrarComPlano } from "@/lib/assinaturas/funil";
import { PRECOS } from "@/lib/assinaturas/precos";
import { formatBRL } from "@/lib/utils";
import { AbrirCheckout } from "../_componentes/abrir-checkout";

export const metadata: Metadata = { title: "Abrindo o pagamento", robots: { index: false } };

export default async function IniciarCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const plano = planoDaUrl((await searchParams).plano);
  if (!plano) redirect("/precos");
  if (!(await getCurrentUser())) redirect(urlEntrarComPlano(plano));
  const preco = PRECOS[plano];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-10 px-4 py-10">
      <Link href="/" aria-label="Ir para o início">
        <Logo />
      </Link>
      <section className="grid gap-4 rounded-lg border border-border bg-surface p-6">
        <div className="grid gap-1">
          <h1 className="text-lg font-extrabold">Pro · {preco.rotulo}</h1>
          <p className="tabular text-muted-foreground">{formatBRL(preco.centavos)}</p>
        </div>
        <AbrirCheckout intervalo={plano} />
      </section>
    </main>
  );
}
