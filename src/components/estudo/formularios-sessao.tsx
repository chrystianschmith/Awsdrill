"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { excluirSessaoAction, lancarManualAction, salvarPomodoroAction } from "@/lib/estudo/actions";
import type { OpcaoExame } from "@/lib/estudo/consultas";

type Erros = Record<string, string[] | undefined>;

/** Lançamento manual de estudo offline (máx. 4h por lançamento). */
export function LancamentoManual({ exames, hoje }: { exames: OpcaoExame[]; hoje: string }) {
  const [examVersionId, setExamVersionId] = useState(exames[0]?.id ?? "");
  const dominios = exames.find((e) => e.id === examVersionId)?.dominios ?? [];
  const [domainId, setDomainId] = useState(dominios[0]?.id ?? "");
  const [topicId, setTopicId] = useState("");
  const [dia, setDia] = useState(hoje);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const tarefas = dominios.find((d) => d.id === domainId)?.tarefas ?? [];

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        const r = await lancarManualAction({ examVersionId, domainId, topicId: topicId || null, dia, inicio, fim });
        setEnviando(false);
        if (!r.ok) {
          setErros(r.fieldErrors ?? {});
          setErroGeral(r.fieldErrors ? null : r.error);
          return;
        }
        setErros({});
        setErroGeral(null);
        setInicio("");
        setFim("");
        toast.success("Estudo lançado.");
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Exame" htmlFor="manual-exame" error={erros.examVersionId?.[0]}>
          <NativeSelect
            id="manual-exame"
            value={examVersionId}
            onChange={(e) => {
              setExamVersionId(e.target.value);
              setDomainId(exames.find((x) => x.id === e.target.value)?.dominios[0]?.id ?? "");
              setTopicId("");
            }}
          >
            {exames.map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigo}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Domínio" htmlFor="manual-dominio" error={erros.domainId?.[0]}>
          <NativeSelect
            id="manual-dominio"
            value={domainId}
            onChange={(e) => {
              setDomainId(e.target.value);
              setTopicId("");
            }}
          >
            {dominios.map((d) => (
              <option key={d.id} value={d.id}>
                {d.rotulo}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Tarefa (opcional)" htmlFor="manual-tarefa">
          <NativeSelect id="manual-tarefa" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">Domínio inteiro</option>
            {tarefas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.rotulo}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Dia" htmlFor="manual-dia" error={erros.dia?.[0]}>
          <Input id="manual-dia" type="date" max={hoje} value={dia} onChange={(e) => setDia(e.target.value)} required />
        </Field>
        <Field label="Início" htmlFor="manual-inicio" error={erros.inicio?.[0]}>
          <Input id="manual-inicio" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
        </Field>
        <Field label="Fim" htmlFor="manual-fim" error={erros.fim?.[0]}>
          <Input id="manual-fim" type="time" value={fim} onChange={(e) => setFim(e.target.value)} required />
        </Field>
      </div>
      {erroGeral ? (
        <p role="alert" className="text-sm text-danger">
          {erroGeral}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={enviando || !domainId}>
          {enviando ? "Salvando..." : "Lançar estudo"}
        </Button>
        <p className="text-xs text-muted-foreground">Até 4 horas por lançamento, sem sobrepor outras sessões.</p>
      </div>
    </form>
  );
}

/** Configuração do Pomodoro (padrão 25/5, pausa longa de 15 a cada 4). */
export function PomodoroConfig({
  valores,
}: {
  valores: { pomodoroWorkMin: number; pomodoroBreakMin: number; pomodoroLongMin: number; pomodoroLongEvery: number };
}) {
  const [v, setV] = useState(valores);
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const campo = (chave: keyof typeof v, rotulo: string) => (
    <Field label={rotulo} htmlFor={`pomo-${chave}`} error={erros[chave]?.[0]}>
      <Input
        id={`pomo-${chave}`}
        type="number"
        inputMode="numeric"
        className="tabular"
        value={v[chave]}
        onChange={(e) => setV({ ...v, [chave]: Number(e.target.value) })}
      />
    </Field>
  );
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        const r = await salvarPomodoroAction(v);
        setEnviando(false);
        if (!r.ok) {
          setErros(r.fieldErrors ?? {});
          if (!r.fieldErrors) toast.error(r.error);
          return;
        }
        setErros({});
        toast.success("Pomodoro atualizado.");
      }}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {campo("pomodoroWorkMin", "Foco (min)")}
        {campo("pomodoroBreakMin", "Pausa (min)")}
        {campo("pomodoroLongMin", "Pausa longa (min)")}
        {campo("pomodoroLongEvery", "Longa a cada")}
      </div>
      <div>
        <Button type="submit" variant="secondary" size="sm" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

/** Excluir sessão com confirmação. */
export function ExcluirSessao({ sessionId, rotulo }: { sessionId: string; rotulo: string }) {
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Excluir sessão ${rotulo}`}
          className="size-8 text-muted-foreground"
        >
          <Trash2 aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent title="Excluir sessão?" description={`${rotulo}. O tempo sai das estatísticas.`}>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              const r = await excluirSessaoAction(sessionId);
              setEnviando(false);
              if (!r.ok) toast.error(r.error);
              else toast.success("Sessão excluída.");
            }}
          >
            {enviando ? "Excluindo..." : "Excluir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
