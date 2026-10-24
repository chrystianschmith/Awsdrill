"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { moderarQuestoesAction } from "@/lib/admin/actions";

/** Aprovar (uma ou várias) e rejeitar com motivo. */
export function ModerarQuestao({ ids, rotulo }: { ids: string[]; rotulo: string }) {
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const router = useRouter();
  const varias = ids.length > 1;

  const decidir = (aprovar: boolean) =>
    iniciar(async () => {
      const r = aprovar
        ? await moderarQuestoesAction({ ids, aprovar: true })
        : await moderarQuestoesAction({ ids, aprovar: false, nota });
      if (!r.ok) {
        setErro(r.fieldErrors?.nota?.[0]);
        toast.error(r.error);
        return;
      }
      toast.success(aprovar ? `${r.data.moderadas} aprovada(s).` : `${r.data.moderadas} rejeitada(s).`);
      setAberto(false);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant={varias ? "secondary" : "primary"}
        disabled={pendente}
        onClick={() => decidir(true)}
        aria-label={varias ? undefined : `Aprovar ${rotulo}`}
      >
        {pendente ? "Aguarde..." : varias ? `Aprovar as ${ids.length} desta página` : "Aprovar"}
      </Button>
      {varias ? null : (
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" aria-label={`Rejeitar ${rotulo}`}>
              Rejeitar
            </Button>
          </DialogTrigger>
          <DialogContent title="Rejeitar questão" description="O motivo fica guardado para quem revisar o banco.">
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                decidir(false);
              }}
            >
              <Field label="Motivo" htmlFor={`nota-${ids[0]}`} error={erro}>
                <Textarea
                  id={`nota-${ids[0]}`}
                  rows={3}
                  maxLength={500}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="ghost" size="sm">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" variant="danger" size="sm" disabled={pendente}>
                  Rejeitar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
