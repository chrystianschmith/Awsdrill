"use client";

import { Button } from "@/components/ui/button";

export default function ErroConta({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Não foi possível carregar sua conta</h1>
        <p className="text-sm text-muted-foreground">Tente novamente em instantes. Seus dados estão seguros.</p>
      </div>
      <Button type="button" onClick={() => retry()} className="w-fit">
        Tentar novamente
      </Button>
    </div>
  );
}
