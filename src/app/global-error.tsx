"use client";

import { useEffect } from "react";
import { ErroConteudo } from "@/components/app/erro-conteudo";
import { BRAND } from "@/lib/brand";
import "./globals.css";

/** Substitui o layout raiz quando ele próprio falha (500). */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    try {
      const t = localStorage.getItem("tema");
      const escuro = t ? t === "escuro" : matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", escuro);
    } catch {
      // sem storage: segue o padrão claro
    }
  }, []);

  return (
    <html lang="pt-BR">
      <body className="min-h-full font-sans">
        <title>{`Erro · ${BRAND.name}`}</title>
        <main id="conteudo" className="px-4">
          <ErroConteudo digest={error.digest} retry={retry} />
        </main>
      </body>
    </html>
  );
}
