"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { confirmarTempoRealAction } from "@/lib/estudo/actions";

/** Pergunta o tempo real de uma sessão encerrada automaticamente em 4h. */
export function ConfirmarTempoDialog({
  sessao,
  onClose,
}: {
  sessao: { id: string; durationSec: number } | null;
  onClose: () => void;
}) {
  const [minutos, setMinutos] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);
  const padrao = sessao ? String(Math.round(sessao.durationSec / 60)) : "";
  return (
    <Dialog
      open={sessao !== null}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setMinutos("");
          setErro(undefined);
          onClose();
        }
      }}
    >
      <DialogContent
        title="Quanto você estudou de fato?"
        description="A sessão passou de 4 horas e foi encerrada automaticamente. Informe o tempo real (até 4 horas)."
      >
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!sessao) return;
            setEnviando(true);
            const r = await confirmarTempoRealAction({ sessionId: sessao.id, minutos: Number(minutos || padrao) });
            setEnviando(false);
            if (!r.ok) {
              setErro(r.fieldErrors?.minutos?.[0] ?? r.error);
              return;
            }
            toast.success("Tempo confirmado.");
            setMinutos("");
            onClose();
          }}
        >
          <Field label="Minutos estudados" htmlFor="tempo-real" error={erro} hint="Até 240 minutos.">
            <Input
              id="tempo-real"
              type="number"
              inputMode="numeric"
              min={0}
              max={240}
              className="tabular"
              value={minutos || padrao}
              aria-invalid={Boolean(erro)}
              onChange={(e) => setMinutos(e.target.value)}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Aviso com as sessões que ainda aguardam confirmação do tempo real. */
export function SessoesAConfirmar({ sessoes }: { sessoes: { id: string; durationSec: number; rotulo: string }[] }) {
  const [aberta, setAberta] = useState<{ id: string; durationSec: number } | null>(null);
  if (sessoes.length === 0) return null;
  return (
    <Alert tone="warning" className="grid gap-2">
      <p className="font-medium">Confirme o tempo real destas sessões</p>
      <p className="text-muted-foreground">Elas passaram de 4 horas e foram salvas com 4 horas até você confirmar.</p>
      <ul className="grid gap-1">
        {sessoes.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>{s.rotulo}</span>
            <Button size="sm" variant="secondary" onClick={() => setAberta(s)}>
              Informar tempo
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmarTempoDialog sessao={aberta} onClose={() => setAberta(null)} />
    </Alert>
  );
}
