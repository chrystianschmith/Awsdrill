"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { enviarSimuladoAction, responderAction } from "@/lib/simulados/actions";
import type { Chave } from "@/lib/simulados/schemas";
import type { Feedback, SimuladoDTO } from "@/lib/simulados/servico";
import { cn } from "@/lib/utils";

function relogio(seg: number) {
  const s = Math.max(0, seg);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/**
 * Tela do simulado. O cliente só guarda a seleção da questão atual: o sorteio, o prazo,
 * a correção e o gabarito vêm do servidor.
 */
export function ExecutarSimulado({ simulado }: { simulado: SimuladoDTO }) {
  const router = useRouter();
  const prova = simulado.mode === "PROVA";
  const total = simulado.questoes.length;
  const [indice, setIndice] = useState(() => {
    const i = simulado.questoes.findIndex((q) => q.selecionadas === null);
    return i === -1 ? 0 : i;
  });
  const [marcadas, setMarcadas] = useState<Record<string, Chave[]>>(() =>
    Object.fromEntries(simulado.questoes.flatMap((q) => (q.selecionadas ? [[q.id, q.selecionadas as Chave[]]] : []))),
  );
  const [feedbacks, setFeedbacks] = useState<Record<string, Feedback>>(() =>
    Object.fromEntries(simulado.questoes.flatMap((q) => (q.feedback ? [[q.id, q.feedback]] : []))),
  );
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Prazo: relógio local ajustado pelo horário do servidor.
  const [offset] = useState(() => new Date(simulado.serverNow).getTime() - Date.now());
  const prazo = simulado.deadlineAt ? new Date(simulado.deadlineAt).getTime() : null;
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!prazo) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [prazo]);
  const restante = prazo ? Math.ceil((prazo - (agora + offset)) / 1000) : null;

  const enviar = useCallback(async () => {
    setOcupado(true);
    const r = await enviarSimuladoAction(simulado.id);
    if (!r.ok) {
      setOcupado(false);
      return toast.error(r.error);
    }
    router.push(`/simulados/${simulado.id}/relatorio`);
  }, [router, simulado.id]);

  const enviouNoPrazo = useRef(false);
  useEffect(() => {
    if (restante !== null && restante <= 0 && !enviouNoPrazo.current) {
      enviouNoPrazo.current = true;
      toast.info("O tempo acabou. Enviando suas respostas.");
      void enviar();
    }
  }, [restante, enviar]);

  const q = simulado.questoes[indice]!;
  const selecao = marcadas[q.id] ?? [];
  const fb = feedbacks[q.id];
  const respondidas = Object.keys(prova ? marcadas : feedbacks).length;

  const alternar = async (key: Chave) => {
    if (fb) return;
    const nova =
      q.quantasCorretas === 1
        ? [key]
        : selecao.includes(key)
          ? selecao.filter((k) => k !== key)
          : selecao.length < q.quantasCorretas
            ? [...selecao, key]
            : selecao;
    setMarcadas((m) => ({ ...m, [q.id]: nova }));
    setErro(null);
    // Prova: grava assim que a seleção está completa (pode trocar até enviar).
    if (prova && nova.length === q.quantasCorretas) {
      const r = await responderAction({ attemptId: simulado.id, questionId: q.id, selectedKeys: nova });
      if (!r.ok) {
        setErro(r.error);
        if (r.code === "prazo" || r.code === "encerrado") router.push(`/simulados/${simulado.id}/relatorio`);
      }
    }
  };

  const responderTreino = async () => {
    setOcupado(true);
    const r = await responderAction({ attemptId: simulado.id, questionId: q.id, selectedKeys: selecao });
    setOcupado(false);
    if (!r.ok) return setErro(r.error);
    if (r.data) setFeedbacks((f) => ({ ...f, [q.id]: r.data! }));
  };

  const ultima = indice === total - 1;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="tabular text-sm text-muted-foreground">
          {simulado.examCode} · {prova ? "Prova" : "Treino"} · questão {indice + 1} de {total} · {respondidas}{" "}
          {respondidas === 1 ? "respondida" : "respondidas"}
        </p>
        {restante !== null ? (
          <p
            role="timer"
            aria-label="Tempo restante"
            className={cn("tabular text-lg font-semibold", restante <= 300 ? "text-danger" : "text-foreground")}
          >
            {relogio(restante)}
          </p>
        ) : null}
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:p-6">
          <p className="text-xs text-muted-foreground">{q.dominio}</p>
          <h2 className="whitespace-pre-line text-base font-medium leading-relaxed">{q.stem}</h2>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm text-muted-foreground">
              {q.quantasCorretas === 1 ? "Escolha uma alternativa." : `Escolha ${q.quantasCorretas} alternativas.`}
            </legend>
            {q.options.map((o) => {
              const marcada = selecao.includes(o.key);
              const correta = fb?.correctKeys.includes(o.key);
              return (
                <label
                  key={o.key}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3.5 text-[0.94rem]",
                    fb
                      ? correta
                        ? "border-success bg-success/10"
                        : marcada
                          ? "border-danger bg-danger/10"
                          : "border-input"
                      : marcada
                        ? "border-primary-strong bg-primary-soft"
                        : "border-input hover:bg-surface-muted",
                    fb && "cursor-default",
                  )}
                >
                  <input
                    type={q.quantasCorretas === 1 ? "radio" : "checkbox"}
                    name={`q-${q.id}`}
                    value={o.key}
                    checked={marcada}
                    disabled={Boolean(fb)}
                    onChange={() => void alternar(o.key)}
                    className="mt-0.5"
                  />
                  <span className="flex gap-3">
                    <span
                      aria-hidden
                      className="grid size-6 shrink-0 place-items-center rounded-sm border border-current/30 font-mono text-[0.8rem]"
                    >
                      {o.key}
                    </span>
                    <span>
                      <span className="sr-only">{o.key}. </span>
                      {o.text}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {fb ? (
            <div
              className={cn(
                "grid gap-2 rounded-lg border p-4 text-sm",
                fb.isCorrect ? "border-success/40 bg-success/10" : "border-danger/30 bg-danger/10",
              )}
            >
              <p className="inline-flex items-center gap-2 font-medium">
                {fb.isCorrect ? (
                  <CircleCheck aria-hidden className="size-4" />
                ) : (
                  <CircleX aria-hidden className="size-4" />
                )}
                {fb.isCorrect ? "Resposta certa" : `Resposta errada. Correta: ${fb.correctKeys.join(", ")}`}
              </p>
              <p className="whitespace-pre-line leading-relaxed">{fb.explanation}</p>
              <ul className="grid gap-1">
                {fb.docUrls.map((u) => (
                  <li key={u}>
                    <a
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary-strong underline underline-offset-4"
                    >
                      Documentação oficial <ExternalLink aria-hidden className="size-3" />
                    </a>
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

          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="secondary" disabled={indice === 0} onClick={() => setIndice((i) => i - 1)}>
              Anterior
            </Button>
            <div className="flex flex-wrap gap-2">
              {!prova && !fb ? (
                <Button
                  disabled={ocupado || selecao.length !== q.quantasCorretas}
                  onClick={() => void responderTreino()}
                >
                  Responder
                </Button>
              ) : null}
              {!ultima ? (
                <Button variant={!prova && !fb ? "secondary" : "primary"} onClick={() => setIndice((i) => i + 1)}>
                  {!prova && !fb ? "Pular" : "Próxima"}
                </Button>
              ) : null}
              {prova ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant={ultima ? "primary" : "secondary"} disabled={ocupado}>
                      Enviar prova
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    title="Enviar a prova?"
                    description={
                      respondidas < total
                        ? `Você respondeu ${respondidas} de ${total}. As sem resposta contam como erradas.`
                        : "Depois de enviar não dá para trocar respostas."
                    }
                  >
                    <div className="flex justify-end gap-2">
                      <DialogClose asChild>
                        <Button variant="secondary">Continuar a prova</Button>
                      </DialogClose>
                      <Button disabled={ocupado} onClick={() => void enviar()}>
                        Enviar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : ultima || respondidas === total ? (
                <Button variant={fb ? "primary" : "secondary"} disabled={ocupado} onClick={() => void enviar()}>
                  Ver resultado
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {prova ? (
        <nav aria-label="Questões da prova">
          <ol className="flex flex-wrap gap-1.5">
            {simulado.questoes.map((x, i) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => setIndice(i)}
                  aria-label={`Questão ${i + 1}${marcadas[x.id]?.length === x.quantasCorretas ? ", respondida" : ""}`}
                  aria-current={i === indice ? "step" : undefined}
                  className={cn(
                    "tabular size-9 rounded-md border text-xs",
                    i === indice
                      ? "border-primary-strong ring-2 ring-primary-strong/30"
                      : marcadas[x.id]?.length === x.quantasCorretas
                        ? "border-primary-strong bg-primary-soft"
                        : "border-input",
                  )}
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </div>
  );
}
