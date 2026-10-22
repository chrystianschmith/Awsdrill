"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import {
  definirDataProvaAction,
  definirStatusTopicoAction,
  deixarDeSeguirAction,
  seguirExameAction,
} from "@/lib/estudo/actions";
import { ROTULO_STATUS, STATUS_TOPICO, type StatusTopico } from "@/lib/estudo/progresso";

export function SeguirExame({ examVersionId, codigo }: { examVersionId: string; codigo: string }) {
  const [enviando, setEnviando] = useState(false);
  return (
    <Button
      size="sm"
      disabled={enviando}
      aria-label={`Seguir ${codigo}`}
      onClick={async () => {
        setEnviando(true);
        const r = await seguirExameAction(examVersionId);
        setEnviando(false);
        if (!r.ok) toast.error(r.error);
        else toast.success(`Agora você estuda o ${codigo}.`);
      }}
    >
      {enviando ? "Seguindo..." : "Seguir"}
    </Button>
  );
}

export function DeixarDeSeguir({ examVersionId, codigo }: { examVersionId: string; codigo: string }) {
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Deixar de seguir
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Deixar de seguir o ${codigo}?`}
        description="O exame sai do Hoje e do timer. Suas sessões e o status das tarefas ficam guardados se você voltar."
      >
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              const r = await deixarDeSeguirAction(examVersionId);
              setEnviando(false);
              if (!r.ok) toast.error(r.error);
              else toast.success(`Você deixou de seguir o ${codigo}.`);
            }}
          >
            {enviando ? "Saindo..." : "Deixar de seguir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Data da prova (opcional): alimenta a contagem regressiva do Hoje. */
export function DataProvaForm({
  examVersionId,
  codigo,
  valor,
  hoje,
}: {
  examVersionId: string;
  codigo: string;
  valor: string;
  hoje: string;
}) {
  const [data, setData] = useState(valor);
  const [erro, setErro] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);
  const id = `prova-${examVersionId}`;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        const r = await definirDataProvaAction({ examVersionId, data });
        setEnviando(false);
        if (!r.ok) return setErro(r.fieldErrors?.data?.[0] ?? r.error);
        setErro(undefined);
        toast.success(data ? "Data da prova salva." : "Data da prova removida.");
      }}
    >
      <Field label={`Data da prova do ${codigo}`} htmlFor={id} error={erro}>
        <Input id={id} type="date" min={hoje} value={data} onChange={(e) => setData(e.target.value)} />
      </Field>
      <Button type="submit" variant="secondary" size="sm" disabled={enviando}>
        {enviando ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}

/** Status de uma task statement. */
export function StatusTarefa({ topicId, rotulo, status }: { topicId: string; rotulo: string; status: StatusTopico }) {
  const [atual, setAtual] = useState(status);
  const [enviando, setEnviando] = useState(false);
  return (
    <NativeSelect
      aria-label={`Status de ${rotulo}`}
      className="h-8 w-36 text-xs"
      value={atual}
      disabled={enviando}
      onChange={async (e) => {
        const novo = e.target.value as StatusTopico;
        const anterior = atual;
        setAtual(novo);
        setEnviando(true);
        const r = await definirStatusTopicoAction({ topicId, status: novo });
        setEnviando(false);
        if (!r.ok) {
          setAtual(anterior);
          toast.error(r.error);
        }
      }}
    >
      {STATUS_TOPICO.map((s) => (
        <option key={s} value={s}>
          {ROTULO_STATUS[s]}
        </option>
      ))}
    </NativeSelect>
  );
}
