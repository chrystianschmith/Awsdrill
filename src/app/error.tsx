"use client";

import { ErroConteudo } from "@/components/app/erro-conteudo";

export default function Erro({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="conteudo" className="px-4">
      <ErroConteudo digest={error.digest} retry={retry} />
    </main>
  );
}
