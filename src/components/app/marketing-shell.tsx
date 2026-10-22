import Link from "next/link";
import type * as React from "react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { RegistrarSW } from "./registrar-sw";
import { SkipLink } from "./skip-link";
import { ThemeToggle } from "./theme-toggle";

/** Cabeçalho e rodapé das páginas públicas (início, termos, privacidade). */
export async function MarketingShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <RegistrarSW />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" aria-label={`${BRAND.name}, página inicial`}>
            <Logo />
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1 text-sm">
            <Link href="/certificacoes" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:block">
              Certificações
            </Link>
            {user ? (
              <Link href="/hoje" className={buttonVariants({ size: "sm" })}>
                Ir para o painel
              </Link>
            ) : (
              <>
                <Link href="/entrar" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Entrar
                </Link>
                <Link href="/cadastro" className={buttonVariants({ size: "sm" })}>
                  Criar conta
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 text-sm text-muted-foreground">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {BRAND.name}
            </p>
            <nav aria-label="Rodapé" className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href="/certificacoes" className="hover:text-foreground sm:hidden">
                Certificações
              </Link>
              <Link href="/termos" className="hover:text-foreground">
                Termos
              </Link>
              <Link href="/privacidade" className="hover:text-foreground">
                Privacidade
              </Link>
            </nav>
            <ThemeToggle />
          </div>
          <p>
            Não somos afiliados à Amazon Web Services; nomes de serviços e exames são citados apenas como referência.
            Prontidão é uma estimativa, não garantia de aprovação.
          </p>
        </div>
      </footer>
    </div>
  );
}
