"use client";

import { Button } from "@/components/ui/button";

export default function ErroAuth({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[1.75rem] font-extrabold">Algo deu errado</h1>
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar esta página. Tente novamente em instantes.
        </p>
      </div>
      <Button type="button" onClick={() => retry()} className="w-fit">
        Tentar novamente
      </Button>
    </div>
  );
}
