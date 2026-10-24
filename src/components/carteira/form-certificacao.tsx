"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import {
  adicionarCertificacaoAction,
  editarCertificacaoAction,
  excluirCertificacaoAction,
} from "@/lib/carteira/actions";

export type OpcaoCertificacao = { id: string; nome: string; codigos: string[] };
export type ValoresCertificacao = {
  certificationId: string;
  examCode: string;
  result: "PASSED" | "FAILED";
  examDate: string;
  scaledScore: string;
  badgeUrl: string;
};

/** Adicionar (sem `registro`) ou editar um item da carteira, num diálogo. */
export function FormCertificacao({
  opcoes,
  hoje,
  registro,
  inicial,
}: {
  opcoes: OpcaoCertificacao[];
  hoje: string;
  registro?: { id: string; nome: string };
  inicial?: ValoresCertificacao;
}) {
  const vazio: ValoresCertificacao = {
    certificationId: opcoes[0]?.id ?? "",
    examCode: "",
    result: "PASSED",
    examDate: "",
    scaledScore: "",
    badgeUrl: "",
  };
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState<ValoresCertificacao>(inicial ?? vazio);
  const [erros, setErros] = useState<Record<string, string[] | undefined>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const cert = opcoes.find((o) => o.id === v.certificationId);
  const campo = (k: keyof ValoresCertificacao) => (e: { target: { value: string } }) =>
    setV((a) => ({ ...a, [k]: e.target.value }));
  const prefixo = registro ? `cert-${registro.id}` : "cert-novo";

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        setAberto(o);
        if (o) {
          setV(inicial ?? vazio);
          setErros({});
          setErro(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {registro ? (
          <Button variant="ghost" size="sm" aria-label={`Editar ${registro.nome}`}>
            <Pencil aria-hidden />
            Editar
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden />
            Adicionar certificação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={registro ? `Editar ${registro.nome}` : "Adicionar certificação"}
        description="Informe o resultado do exame. A validade é calculada a partir da data."
      >
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setEnviando(true);
            const dados = {
              certificationId: v.certificationId,
              examCode: v.examCode,
              result: v.result,
              examDate: v.examDate,
              scaledScore: v.scaledScore ? Number(v.scaledScore) : null,
              badgeUrl: v.badgeUrl,
            };
            const r = registro
              ? await editarCertificacaoAction(registro.id, dados)
              : await adicionarCertificacaoAction(dados);
            setEnviando(false);
            if (!r.ok) {
              setErros(r.fieldErrors ?? {});
              return setErro(r.error);
            }
            setAberto(false);
            toast.success(registro ? "Registro atualizado." : "Certificação adicionada à carteira.");
          }}
        >
          <Field label="Certificação" htmlFor={`${prefixo}-cert`} error={erros.certificationId?.[0]}>
            <NativeSelect
              id={`${prefixo}-cert`}
              value={v.certificationId}
              onChange={(e) => setV((a) => ({ ...a, certificationId: e.target.value, examCode: "" }))}
            >
              {opcoes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Resultado" htmlFor={`${prefixo}-resultado`}>
              <NativeSelect id={`${prefixo}-resultado`} value={v.result} onChange={campo("result")}>
                <option value="PASSED">Aprovado</option>
                <option value="FAILED">Reprovado</option>
              </NativeSelect>
            </Field>
            <Field label="Data do exame" htmlFor={`${prefixo}-data`} error={erros.examDate?.[0]}>
              <Input
                id={`${prefixo}-data`}
                type="date"
                max={hoje}
                required
                value={v.examDate}
                onChange={campo("examDate")}
              />
            </Field>
            <Field label="Código do exame (opcional)" htmlFor={`${prefixo}-codigo`} error={erros.examCode?.[0]}>
              <NativeSelect id={`${prefixo}-codigo`} value={v.examCode} onChange={campo("examCode")}>
                <option value="">Não sei</option>
                {cert?.codigos.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Nota (100 a 1000, opcional)" htmlFor={`${prefixo}-nota`} error={erros.scaledScore?.[0]}>
              <Input
                id={`${prefixo}-nota`}
                type="number"
                inputMode="numeric"
                min={100}
                max={1000}
                value={v.scaledScore}
                onChange={campo("scaledScore")}
              />
            </Field>
          </div>
          <Field
            label="Link do badge (opcional)"
            htmlFor={`${prefixo}-badge`}
            error={erros.badgeUrl?.[0]}
            hint="Link público do seu badge, começando com https://"
          >
            <Input id={`${prefixo}-badge`} type="url" value={v.badgeUrl} onChange={campo("badgeUrl")} />
          </Field>
          {erro ? (
            <p role="alert" className="text-sm text-danger">
              {erro}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExcluirCertificacao({ registro }: { registro: { id: string; nome: string } }) {
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Excluir ${registro.nome}`}>
          Excluir
        </Button>
      </DialogTrigger>
      <DialogContent title={`Excluir ${registro.nome}?`} description="O registro sai da carteira e os lembretes param.">
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              const r = await excluirCertificacaoAction(registro.id);
              setEnviando(false);
              if (!r.ok) toast.error(r.error);
              else toast.success("Registro excluído.");
            }}
          >
            {enviando ? "Excluindo..." : "Excluir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
