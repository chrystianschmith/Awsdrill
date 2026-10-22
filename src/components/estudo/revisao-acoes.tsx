"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { registrarRevisaoAction } from "@/lib/estudo/actions";

/** Botões "Revisei bem" / "Tive dificuldade" de uma revisão. */
export function RevisaoAcoes({ reviewId }: { reviewId: string }) {
  const [enviando, setEnviando] = useState(false);
  const registrar = async (boa: boolean) => {
    setEnviando(true);
    const r = await registrarRevisaoAction({ reviewId, boa });
    setEnviando(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(
      boa ? "Revisão registrada. Próxima em um intervalo maior." : "Sem problema: esta tarefa volta amanhã.",
    );
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={enviando} onClick={() => registrar(true)}>
        Revisei bem
      </Button>
      <Button size="sm" variant="secondary" disabled={enviando} onClick={() => registrar(false)}>
        Tive dificuldade
      </Button>
    </div>
  );
}
