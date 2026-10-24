"use client";

import { Button } from "@/components/ui/button";

export default function ErroAssinatura({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
      <h1 className="font-semibold">Não foi possível carregar sua assinatura</h1>
      <p className="text-sm text-muted-foreground">
        Pode ser uma instabilidade momentânea. Seus dados e seu plano não foram alterados.
      </p>
      <Button variant="secondary" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
