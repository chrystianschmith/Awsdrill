"use client";

import { ErroConteudo } from "@/components/app/erro-conteudo";

export default function ErroApp({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErroConteudo digest={error.digest} retry={retry} />;
}
