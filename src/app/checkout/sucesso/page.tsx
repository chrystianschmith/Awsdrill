import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { Confirmando } from "./confirmando";

export const metadata: Metadata = { title: "Confirmando pagamento", robots: { index: false } };

export default async function CheckoutSucessoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const { session_id: sessionId } = await searchParams;
  const valido = typeof sessionId === "string" && /^cs_[A-Za-z0-9_]+$/.test(sessionId);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-10 px-4 py-10">
      <Link href="/hoje" aria-label="Ir para o início">
        <Logo />
      </Link>
      <section className="rounded-lg border border-border bg-surface p-6">
        {valido ? (
          <Confirmando sessionId={sessionId} />
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="text-lg font-semibold">Não encontramos este pagamento</p>
            <p className="text-muted-foreground">Confira o status do seu plano na página da assinatura.</p>
            <Link href="/conta/assinatura" className={buttonVariants()}>
              Ver minha assinatura
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
