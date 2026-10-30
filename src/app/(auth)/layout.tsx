import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/lib/brand";

/** Layout dividido: formulário à esquerda, painel preto da marca à direita (desktop). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <Link href="/" className="w-fit rounded-md" aria-label={`${BRAND.name}, página inicial`}>
          <Logo />
        </Link>
        <main id="conteudo" tabIndex={-1} className="flex flex-1 items-center justify-center py-10 outline-none">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
      <aside className="dark hidden bg-background text-foreground lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="max-w-md">
          <p className="font-display text-3xl font-extrabold leading-tight tracking-tight">
            Estudo distribuído pelo blueprint do exame, simulados por domínio e{" "}
            <span className="text-primary-strong">prontidão medida</span>.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            Você sabe o que falta em cada domínio antes de marcar a prova. Prontidão é uma estimativa, não garantia de
            aprovação.
          </p>
        </div>
      </aside>
    </div>
  );
}
