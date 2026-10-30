import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NaoEncontrada() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-6xl items-center px-4">
        <Link href="/" aria-label={`${BRAND.name}, página inicial`}>
          <Logo />
        </Link>
      </header>
      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-md flex-1 flex-col items-start justify-center gap-4 px-4 pb-24"
      >
        <p className="tabular text-sm font-medium text-muted-foreground">Erro 404</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground">
          O endereço pode ter mudado ou sido digitado errado. Volte para o início e siga de lá.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className={buttonVariants()}>
            Ir para o início
          </Link>
        </div>
      </main>
    </div>
  );
}
