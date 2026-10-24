"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErroAdmin({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-6">
      <div>
        <p className="font-medium">Não foi possível carregar esta página.</p>
        <p className="text-sm text-muted-foreground">
          Tente novamente. Se o erro continuar, confira os logs{error.digest ? ` (código ${error.digest})` : ""}.
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={() => retry()}>
        Tentar novamente
      </Button>
    </div>
  );
}
