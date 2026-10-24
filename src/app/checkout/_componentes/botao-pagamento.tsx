"use client";

import { useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { abrirPortal, iniciarCheckout } from "@/lib/assinaturas/actions";
import type { Intervalo } from "@/lib/assinaturas/precos";

/**
 * Botão que inicia o checkout do Stripe (ou abre o portal do cliente) e
 * redireciona para a página hospedada do Stripe.
 */
export function BotaoPagamento({
  acao,
  children,
  variant,
  size,
  className,
}: {
  acao: { tipo: "checkout"; intervalo: Intervalo } | { tipo: "portal" };
  children: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const [pendente, iniciar] = useTransition();

  function clicar() {
    iniciar(async () => {
      const r = acao.tipo === "checkout" ? await iniciarCheckout(acao.intervalo) : await abrirPortal();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.data.destino === "portal" && acao.tipo === "checkout") {
        toast("Você já tem uma assinatura. Abrindo o portal para gerenciá-la.");
      }
      window.location.assign(r.data.url);
    });
  }

  return (
    <Button type="button" onClick={clicar} disabled={pendente} aria-busy={pendente} variant={variant} size={size} className={className}>
      {pendente ? <Loader2 aria-hidden className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
