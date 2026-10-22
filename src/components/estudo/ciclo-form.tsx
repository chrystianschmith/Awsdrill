"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { criarCicloAction, encerrarCicloAction, previaCicloAction } from "@/lib/estudo/actions";
import { formatMinutos } from "@/lib/utils";

type ExameCiclo = { id: string; codigo: string; dominios: { id: string; rotulo: string; peso: number | null }[] };

/** Montagem do ciclo: exame, domínios e horas; o servidor sugere a distribuição. */
export function CicloForm({
  exames,
  inicial,
}: {
  exames: ExameCiclo[];
  inicial: { examVersionId: string; domainIds: string[]; horas: number };
}) {
  const [examVersionId, setExamVersionId] = useState(inicial.examVersionId);
  const exame = exames.find((e) => e.id === examVersionId) ?? exames[0];
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(inicial.domainIds));
  const [horas, setHoras] = useState(String(inicial.horas));
  const [previa, setPrevia] = useState<Record<string, number> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!exame) return null;
  const entrada = () => ({ examVersionId: exame.id, domainIds: [...selecionados], horas: horas.replace(",", ".") });

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        const r = await criarCicloAction(entrada());
        setEnviando(false);
        if (!r.ok) return setErro(r.error);
        setErro(null);
        setPrevia(null);
        toast.success("Ciclo criado.");
      }}
    >
      {exames.length > 1 ? (
        <div className="max-w-60">
          <Field label="Exame" htmlFor="ciclo-exame">
            <NativeSelect
              id="ciclo-exame"
              value={exame.id}
              onChange={(e) => {
                const novo = exames.find((x) => x.id === e.target.value);
                setExamVersionId(e.target.value);
                setSelecionados(new Set(novo?.dominios.map((d) => d.id) ?? []));
                setPrevia(null);
              }}
            >
              {exames.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.codigo}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      ) : null}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Domínios do ciclo</legend>
        <div className="grid gap-1">
          {exame.dominios.map((d) => (
            <label key={d.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={selecionados.has(d.id)}
                onChange={(e) => {
                  const novo = new Set(selecionados);
                  if (e.target.checked) novo.add(d.id);
                  else novo.delete(d.id);
                  setSelecionados(novo);
                  setPrevia(null);
                }}
              />
              <span className="flex-1">{d.rotulo}</span>
              <span className="tabular text-xs text-muted-foreground">
                {d.peso !== null ? `${d.peso}%` : "peso a confirmar"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="max-w-48">
        <Field label="Horas do ciclo" htmlFor="ciclo-horas" hint="Mínimo de 30 min por domínio.">
          <Input
            id="ciclo-horas"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={1}
            max={100}
            className="tabular"
            value={horas}
            onChange={(e) => {
              setHoras(e.target.value);
              setPrevia(null);
            }}
          />
        </Field>
      </div>
      {previa ? (
        <div className="grid gap-1 rounded-lg border border-border p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">Distribuição sugerida (peso no exam guide)</p>
          <ul className="grid gap-1">
            {exame.dominios
              .filter((d) => previa[d.id] !== undefined)
              .map((d) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <span>{d.rotulo}</span>
                  <span className="tabular">{formatMinutos(previa[d.id] ?? 0)}</span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {erro ? (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={enviando || selecionados.size === 0}
          onClick={async () => {
            setEnviando(true);
            const r = await previaCicloAction(entrada());
            setEnviando(false);
            if (!r.ok) return setErro(r.error);
            setErro(null);
            setPrevia(r.data);
          }}
        >
          Ver distribuição
        </Button>
        <Button type="submit" disabled={enviando || selecionados.size === 0}>
          {enviando ? "Salvando..." : "Criar ciclo"}
        </Button>
      </div>
    </form>
  );
}

export function EncerrarCiclo() {
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Encerrar ciclo
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Encerrar o ciclo atual?"
        description="O histórico de estudo continua salvo. Você pode montar outro ciclo depois."
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
              const r = await encerrarCicloAction();
              setEnviando(false);
              if (!r.ok) toast.error(r.error);
            }}
          >
            Encerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
