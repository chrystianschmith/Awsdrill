"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { iniciarSimuladoAction } from "@/lib/simulados/actions";
import { cn, formatMinutos } from "@/lib/utils";

export type ExameParaSimulado = {
  id: string;
  codigo: string;
  totalQuestoes: number | null;
  duracaoMin: number | null;
  dominios: { id: string; rotulo: string; questoes: number }[];
};

/** Escolha do exame, do modo e (no treino) da quantidade e dos domínios. */
export function IniciarSimulado({
  exames,
  inicial,
  plano = { modoProva: true, treinoEsgotado: false },
}: {
  exames: ExameParaSimulado[];
  /** Só reflete o plano; o servidor recusa de novo ao iniciar. */
  plano?: { modoProva: boolean; treinoEsgotado: boolean };
  /** Vindo do plano de correção: exame e domínio já escolhidos. */
  inicial?: { examVersionId: string; domainId: string | null };
}) {
  const router = useRouter();
  const [examVersionId, setExamVersionId] = useState(inicial?.examVersionId ?? exames[0]?.id ?? "");
  const exame = exames.find((e) => e.id === examVersionId) ?? exames[0];
  const [modo, setModo] = useState<"TREINO" | "PROVA">("TREINO");
  const [quantidade, setQuantidade] = useState("10");
  const [dominios, setDominios] = useState<Set<string>>(
    new Set(
      inicial?.domainId && exames.some((e) => e.dominios.some((d) => d.id === inicial.domainId))
        ? [inicial.domainId]
        : [],
    ),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (!exame) return null;

  const banco = exame.dominios.reduce((s, d) => s + d.questoes, 0);
  const totalProva = exame.totalQuestoes ?? 65;

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        const r = await iniciarSimuladoAction(
          modo === "PROVA"
            ? { mode: "PROVA", examVersionId: exame.id }
            : { mode: "TREINO", examVersionId: exame.id, quantidade: Number(quantidade), domainIds: [...dominios] },
        );
        if (!r.ok) {
          setEnviando(false);
          return setErro(r.error);
        }
        router.push(`/simulados/${r.data.id}`);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Exame" htmlFor="simulado-exame">
          <NativeSelect
            id="simulado-exame"
            value={exame.id}
            onChange={(e) => {
              setExamVersionId(e.target.value);
              setDominios(new Set());
            }}
          >
            {exames.map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigo}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {modo === "TREINO" ? (
          <Field label="Questões" htmlFor="simulado-quantidade">
            <NativeSelect id="simulado-quantidade" value={quantidade} onChange={(e) => setQuantidade(e.target.value)}>
              {["10", "20", "30"].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Modo</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["TREINO", "Treino", "Correção e explicação a cada questão, com link para a documentação oficial."],
              [
                "PROVA",
                "Prova",
                exame.duracaoMin
                  ? `${totalProva} questões em ${formatMinutos(exame.duracaoMin)}, sem correção até o fim.`
                  : "Duração oficial a confirmar.",
              ],
            ] as const
          ).map(([valor, titulo, descricao]) => {
            const bloqueado = valor === "PROVA" && !plano.modoProva;
            return (
              <label
                key={valor}
                className={cn(
                  "flex gap-3 rounded-md border p-3 text-sm",
                  bloqueado ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                  modo === valor ? "border-primary-strong bg-primary-soft" : "border-input",
                )}
              >
                <input
                  type="radio"
                  name="modo"
                  value={valor}
                  checked={modo === valor}
                  disabled={bloqueado}
                  onChange={() => setModo(valor)}
                  className="mt-1"
                />
                <span className="grid gap-0.5">
                  <span className="font-medium">
                    {titulo}
                    {bloqueado ? <span className="font-normal text-muted-foreground"> · plano Pro</span> : null}
                  </span>
                  <span className="text-muted-foreground">{descricao}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {modo === "TREINO" ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Domínios (nenhum marcado = exame inteiro)</legend>
          <div className="grid gap-1">
            {exame.dominios.map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-muted"
              >
                <input
                  type="checkbox"
                  checked={dominios.has(d.id)}
                  onChange={(e) => {
                    const novo = new Set(dominios);
                    if (e.target.checked) novo.add(d.id);
                    else novo.delete(d.id);
                    setDominios(novo);
                  }}
                />
                <span className="flex-1">{d.rotulo}</span>
                <span className="tabular text-xs text-muted-foreground">{d.questoes} no banco</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : banco > 0 && banco < totalProva ? (
        <p className="text-sm text-muted-foreground">
          O banco deste exame ainda tem {banco} questões publicadas; a prova usa todas, com o tempo oficial.
        </p>
      ) : null}

      {erro ? (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={enviando || banco === 0 || (modo === "TREINO" && plano.treinoEsgotado)}>
          {enviando ? "Preparando..." : modo === "PROVA" ? "Começar prova" : "Começar treino"}
        </Button>
      </div>
    </form>
  );
}
