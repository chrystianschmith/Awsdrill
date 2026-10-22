import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Sem conexão", robots: { index: false } };

/** Página servida pelo service worker (public/sw.js) quando não há rede. */
export default function Offline() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <Logo />
      <h1 className="text-2xl font-semibold tracking-tight">Você está sem conexão</h1>
      <p className="text-sm text-muted-foreground">
        Assim que a internet voltar, recarregue a página. O que você já salvou continua no servidor.
      </p>
      {/* <a> de propósito: sem rede, a navegação precisa ser um recarregamento completo, não uma transição do cliente. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Tentar abrir a página inicial
      </a>
    </main>
  );
}
