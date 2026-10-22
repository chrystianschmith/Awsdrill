"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { reenviarConfirmacao } from "./actions";

/** Botão que reenvia o e-mail de confirmação para o usuário logado. */
export function BotaoReenviarConfirmacao({ className }: { className?: string }) {
  const [pendente, iniciar] = useTransition();
  const [enviado, setEnviado] = useState(false);

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className={className}
      disabled={pendente || enviado}
      onClick={() =>
        iniciar(async () => {
          const r = await reenviarConfirmacao();
          if (r.ok) {
            setEnviado(true);
            toast.success("Enviamos um novo link para o seu e-mail.");
          } else {
            toast.error(r.error);
          }
        })
      }
    >
      {pendente ? "Enviando..." : enviado ? "Link enviado" : "Reenviar e-mail"}
    </Button>
  );
}
