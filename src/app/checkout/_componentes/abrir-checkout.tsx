"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { iniciarCheckout } from "@/lib/assinaturas/actions";
import type { Intervalo } from "@/lib/assinaturas/precos";

/**
 * Abre o checkout do Stripe assim que a página carrega (último passo do funil
 * de venda). Se algo falhar, mostra o erro e um botão para tentar de novo.
 */
export function AbrirCheckout({ intervalo }: { intervalo: Intervalo }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const disparado = useRef(false);

  function abrir() {
    setErro(null);
    iniciar(async () => {
      const r = await iniciarCheckout(intervalo);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      window.location.assign(r.data.url);
    });
  }

  useEffect(() => {
    if (disparado.current) return;
    disparado.current = true;
    abrir();
    // Só na montagem: abrir() é recriado a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (erro) {
    return (
      <div className="grid gap-3" role="alert">
        <p className="text-danger-strong">{erro}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={abrir} disabled={pendente}>
            Tentar de novo
          </Button>
          <Link href="/precos" className={buttonVariants({ variant: "secondary" })}>
            Ver planos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <p className="flex items-center gap-2 text-muted-foreground" aria-live="polite">
      <Loader2 aria-hidden className="size-4 animate-spin" />
      Abrindo o pagamento seguro do Stripe...
    </p>
  );
}
