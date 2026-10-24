"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { consultarStatusCheckout, type EstadoCheckout } from "@/lib/assinaturas/actions";

const INTERVALO_MS = 2_000;
const LIMITE_MS = 60_000;

type Estado = EstadoCheckout | "esgotado" | "erro";

/**
 * Consulta no servidor, a cada 2 s por até 60 s, se o webhook já liberou o Pro.
 * O redirect do Stripe nunca libera nada sozinho.
 */
export function Confirmando({ sessionId }: { sessionId: string }) {
  const [estado, setEstado] = useState<Estado>("pendente");
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const inicio = Date.now();

    async function consultar() {
      const r = await consultarStatusCheckout(sessionId);
      if (!ativo) return;
      if (!r.ok) {
        setMensagemErro(r.error);
        setEstado("erro");
        return;
      }
      if (r.data.estado === "confirmado" || r.data.estado === "expirado") {
        setEstado(r.data.estado);
        return;
      }
      if (Date.now() - inicio >= LIMITE_MS) {
        setEstado("esgotado");
        return;
      }
      setEstado(r.data.estado);
      timer = setTimeout(consultar, INTERVALO_MS);
    }

    void consultar();
    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  if (estado === "confirmado") {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="inline-flex items-center gap-2 text-lg font-semibold">
          <CheckCircle2 aria-hidden className="size-5 text-success" />
          Pagamento confirmado
        </p>
        <p className="text-muted-foreground">Seu plano Pro está ativo. Todos os recursos já estão liberados.</p>
        <Link href="/hoje" className={buttonVariants()}>
          Começar a estudar
        </Link>
      </div>
    );
  }

  if (estado === "expirado") {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-lg font-semibold">Esta sessão de pagamento expirou</p>
        <p className="text-muted-foreground">Nenhuma cobrança foi feita. Você pode tentar de novo quando quiser.</p>
        <Link href="/precos" className={buttonVariants()}>
          Voltar aos planos
        </Link>
      </div>
    );
  }

  if (estado === "esgotado" || estado === "erro") {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="inline-flex items-center gap-2 text-lg font-semibold">
          <Clock aria-hidden className="size-5 text-muted-foreground" />
          Ainda não recebemos a confirmação
        </p>
        <p className="text-muted-foreground">
          {estado === "erro" && mensagemErro ? `${mensagemErro} ` : ""}
          Alguns pagamentos levam alguns minutos para serem confirmados. Assim que o Stripe confirmar, liberamos o Pro e
          enviamos um e-mail. Você pode acompanhar em Conta, Assinatura.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/conta/assinatura" className={buttonVariants()}>
            Ver minha assinatura
          </Link>
          <Link href="/hoje" className={buttonVariants({ variant: "secondary" })}>
            Ir para Hoje
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3" role="status" aria-live="polite">
      <p className="inline-flex items-center gap-2 text-lg font-semibold">
        <Loader2 aria-hidden className="size-5 animate-spin text-primary" />
        Confirmando pagamento...
      </p>
      <p className="text-muted-foreground">
        {estado === "aguardando_pix"
          ? "Aguardando a confirmação do Pix. Se ainda não pagou, conclua o pagamento no app do seu banco."
          : "Estamos aguardando a confirmação do Stripe. Isso costuma levar poucos segundos."}
      </p>
    </div>
  );
}
