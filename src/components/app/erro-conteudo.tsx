"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/** Corpo padrão de erro (500): explica, oferece "tentar novamente" e mostra o código para o suporte. */
export function ErroConteudo({ digest, retry }: { digest?: string; retry: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-start gap-4 py-12">
      <p className="tabular text-sm font-medium text-muted-foreground">Erro 500</p>
      <h1 className="text-3xl font-extrabold tracking-tight">Algo deu errado do nosso lado</h1>
      <p className="text-sm text-muted-foreground">
        Seus dados estão salvos. Tente de novo; se continuar, avise o suporte informando o código abaixo.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw aria-hidden /> Tentar novamente
        </Button>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          Ir para o início
        </Link>
      </div>
      {digest ? <p className="tabular text-xs text-muted-foreground">Código: {digest}</p> : null}
    </div>
  );
}
