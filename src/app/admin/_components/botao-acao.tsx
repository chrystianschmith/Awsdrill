"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import type { ActionResult } from "@/lib/errors";

type Props = {
  /** Server Action já com os argumentos (ex.: `aprovarVersao.bind(null, { versionId })`). */
  acao: () => Promise<ActionResult<unknown>>;
  rotulo: string;
  sucesso: string;
  /** Pede confirmação antes (ações destrutivas). */
  confirmar?: { titulo: string; descricao: string; rotulo: string };
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
};

export function BotaoAcao({ acao, rotulo, sucesso, confirmar, variant = "secondary", size = "sm" }: Props) {
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const router = useRouter();

  const executar = () =>
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.success(sucesso);
        setAberto(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });

  if (!confirmar) {
    return (
      <Button type="button" variant={variant} size={size} disabled={pendente} onClick={executar}>
        {pendente ? "Aguarde..." : rotulo}
      </Button>
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button type="button" variant={variant} size={size} disabled={pendente}>
          {rotulo}
        </Button>
      </DialogTrigger>
      <DialogContent title={confirmar.titulo} description={confirmar.descricao}>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            disabled={pendente}
            onClick={executar}
          >
            {pendente ? "Aguarde..." : confirmar.rotulo}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
