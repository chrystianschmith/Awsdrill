"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { salvarMetaAction } from "@/lib/estudo/actions";

/** Ajuste da meta diária e do mínimo do streak. */
export function MetaForm({ dailyGoalMin, streakMinMin }: { dailyGoalMin: number; streakMinMin: number }) {
  const [aberto, setAberto] = useState(false);
  const [meta, setMeta] = useState(String(dailyGoalMin));
  const [minimo, setMinimo] = useState(String(streakMinMin));
  const [erros, setErros] = useState<Record<string, string[] | undefined>>({});
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Ajustar meta
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Meta diária"
        description="Defina quanto quer estudar por dia e o mínimo que mantém a sequência."
      >
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setEnviando(true);
            const r = await salvarMetaAction({ dailyGoalMin: Number(meta), streakMinMin: Number(minimo) });
            setEnviando(false);
            if (!r.ok) {
              setErros(r.fieldErrors ?? {});
              if (!r.fieldErrors) toast.error(r.error);
              return;
            }
            toast.success("Meta atualizada.");
            setAberto(false);
          }}
        >
          <Field label="Meta diária (minutos)" htmlFor="meta-diaria" error={erros.dailyGoalMin?.[0]}>
            <Input
              id="meta-diaria"
              type="number"
              inputMode="numeric"
              className="tabular"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
            />
          </Field>
          <Field
            label="Mínimo para a sequência (minutos)"
            htmlFor="meta-streak"
            error={erros.streakMinMin?.[0]}
            hint="Dias com pelo menos esse tempo contam na sequência."
          >
            <Input
              id="meta-streak"
              type="number"
              inputMode="numeric"
              className="tabular"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value)}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
