import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pagamento não concluído", robots: { index: false } };

export default function CheckoutCanceladoPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-10 px-4 py-10">
      <Link href="/" aria-label="Ir para o início">
        <Logo />
      </Link>
      <section className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface p-6">
        <h1 className="text-lg font-semibold">Pagamento não concluído</h1>
        <p className="text-muted-foreground">
          Você saiu do checkout antes de finalizar. Nenhuma cobrança foi feita e seu plano continua o mesmo.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/precos" className={buttonVariants()}>
            Voltar aos planos
          </Link>
          <Link href="/hoje" className={buttonVariants({ variant: "secondary" })}>
            Continuar no plano atual
          </Link>
        </div>
      </section>
    </main>
  );
}
