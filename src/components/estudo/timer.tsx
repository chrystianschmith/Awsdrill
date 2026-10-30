"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import {
  encerrarSessaoAction,
  iniciarSessaoAction,
  pausarSessaoAction,
  retomarSessaoAction,
  sessaoAtivaAction,
} from "@/lib/estudo/actions";
import type { OpcaoExame } from "@/lib/estudo/consultas";
import type { SessaoAtivaDTO } from "@/lib/estudo/servico-sessoes";
import { MAX_SESSAO_SEG, duracaoPausaSeg, estadoPomodoro, estadoSessao, type PomodoroCfg } from "@/lib/estudo/sessoes";
import { cn, formatCronometro, formatMinutos } from "@/lib/utils";
import { ConfirmarTempoDialog } from "./confirmar-tempo";

type Modo = "LIVRE" | "POMODORO" | "FOCO" | "CICLO";

function paraDatas(s: SessaoAtivaDTO) {
  return {
    startedAt: new Date(s.startedAt),
    pauses: s.pausas.map((p) => ({
      startedAt: new Date(p.startedAt),
      endedAt: p.endedAt ? new Date(p.endedAt) : null,
    })),
  };
}

function ehCampoDeTexto(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(el.tagName) || el.isContentEditable;
}

/**
 * Timer controlado pelo servidor: o cliente só exibe o tempo a partir de
 * startedAt e das pausas gravadas. Fechar a aba não perde nada; ao voltar,
 * o estado é relido do servidor.
 */
export function Timer({
  ativaInicial,
  exames,
  pomodoro,
  inicial,
  ciclo,
}: {
  ativaInicial: SessaoAtivaDTO | null;
  exames: OpcaoExame[];
  pomodoro: PomodoroCfg;
  inicial: { examVersionId?: string; domainId?: string; topicId?: string; mode?: Modo };
  /** Próximo domínio do ciclo aberto; sem ciclo, o modo "Ciclo" não aparece. */
  ciclo: { examVersionId: string; domainId: string; rotulo: string } | null;
}) {
  const [sessao, setSessao] = useState<SessaoAtivaDTO | null>(ativaInicial);
  const [offset, setOffset] = useState(() =>
    ativaInicial ? new Date(ativaInicial.serverNow).getTime() - Date.now() : 0,
  );
  const [agora, setAgora] = useState(() => Date.now());
  const [foco, setFoco] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [pausaPomodoroAte, setPausaPomodoroAte] = useState<number | null>(null);
  const [aConfirmar, setAConfirmar] = useState<{ id: string; durationSec: number } | null>(null);

  const [modo, setModo] = useState<Modo>(inicial.mode ?? "LIVRE");
  const [examVersionId, setExamVersionId] = useState(inicial.examVersionId ?? exames[0]?.id ?? "");
  const dominios = exames.find((e) => e.id === examVersionId)?.dominios ?? [];
  const [domainId, setDomainId] = useState(inicial.domainId ?? dominios[0]?.id ?? "");
  const [topicId, setTopicId] = useState(inicial.topicId ?? "");
  const focoRef = useRef<HTMLDivElement>(null);
  const blocosVistos = useRef<number | null>(null);

  const receber = useCallback((s: SessaoAtivaDTO | null) => {
    setSessao(s);
    if (s) setOffset(new Date(s.serverNow).getTime() - Date.now());
  }, []);

  // Relógio local (sem polling do servidor).
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Ao voltar para a aba, relê o estado do servidor.
  useEffect(() => {
    const aoVoltar = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await sessaoAtivaAction();
      if (r.ok) receber(r.data);
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [receber]);

  const agoraServidor = new Date(agora + offset);
  const estado = sessao ? estadoSessao(paraDatas(sessao), agoraServidor) : null;
  const pomo = sessao && estado && sessao.mode === "POMODORO" ? estadoPomodoro(estado.efetivoSeg, pomodoro) : null;

  const pausar = useCallback(async () => {
    setOcupado(true);
    const r = await pausarSessaoAction();
    setOcupado(false);
    if (!r.ok) return toast.error(r.error);
    receber(r.data);
  }, [receber]);

  const retomar = useCallback(async () => {
    setOcupado(true);
    const r = await retomarSessaoAction();
    setOcupado(false);
    setPausaPomodoroAte(null);
    if (!r.ok) return toast.error(r.error);
    receber(r.data);
  }, [receber]);

  const encerrar = useCallback(async () => {
    setOcupado(true);
    const r = await encerrarSessaoAction();
    setOcupado(false);
    if (!r.ok) return toast.error(r.error);
    setSessao(null);
    setFoco(false);
    setPausaPomodoroAte(null);
    blocosVistos.current = null;
    if (r.data.autoClosed) setAConfirmar({ id: r.data.id, durationSec: r.data.durationSec });
    else if (r.data.ajustadaAoLimite) toast.info("Sessão salva até o limite de 16 horas do dia.");
    else toast.success(`Sessão salva: ${formatMinutos(r.data.durationSec / 60)}.`);
  }, []);

  const iniciar = useCallback(async () => {
    if (!examVersionId || !domainId) return toast.error("Escolha o exame e o domínio.");
    setOcupado(true);
    const r = await iniciarSessaoAction({ examVersionId, domainId, topicId: topicId || null, mode: modo });
    setOcupado(false);
    if (!r.ok) return toast.error(r.error);
    blocosVistos.current = 0;
    receber(r.data);
    if (modo === "FOCO") setFoco(true);
  }, [examVersionId, domainId, topicId, modo, receber]);

  // Pomodoro: ao fechar um bloco, pausa a sessão e conta o intervalo.
  useEffect(() => {
    if (!pomo || !estado || estado.pausada || ocupado) return;
    if (blocosVistos.current === null) {
      blocosVistos.current = pomo.concluidos;
      return;
    }
    if (pomo.concluidos > blocosVistos.current) {
      blocosVistos.current = pomo.concluidos;
      const ate = Date.now() + duracaoPausaSeg(pomo.concluidos, pomodoro) * 1000;
      void pausar().then(() => setPausaPomodoroAte(ate));
      toast.info("Bloco concluído. Hora do intervalo.");
    }
  }, [pomo, estado, ocupado, pausar, pomodoro]);

  // Limite de 4h: encerra e pede o tempo real.
  useEffect(() => {
    if (!sessao) return;
    const atual = estadoSessao(paraDatas(sessao), new Date(Date.now() + offset));
    if (atual.pausada) return;
    const t = setTimeout(() => void encerrar(), Math.max(0, (MAX_SESSAO_SEG - atual.efetivoSeg) * 1000));
    return () => clearTimeout(t);
  }, [sessao, offset, encerrar]);

  // Atalhos: Espaço inicia/pausa, Esc sai do modo foco.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && foco) {
        setFoco(false);
        return;
      }
      if (e.code !== "Space" || ehCampoDeTexto(e.target) || ocupado) return;
      e.preventDefault();
      if (!sessao) void iniciar();
      else if (estado?.pausada) void retomar();
      else void pausar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [foco, sessao, estado?.pausada, ocupado, iniciar, retomar, pausar]);

  // Modo foco em tela cheia (quando o navegador permite).
  useEffect(() => {
    if (foco) {
      focoRef.current?.requestFullscreen?.().catch(() => undefined);
    } else if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, [foco]);
  useEffect(() => {
    const sair = () => {
      if (!document.fullscreenElement) setFoco(false);
    };
    document.addEventListener("fullscreenchange", sair);
    return () => document.removeEventListener("fullscreenchange", sair);
  }, []);

  useEffect(() => {
    const base = document.title;
    if (sessao && estado) document.title = `${formatCronometro(estado.efetivoSeg)} · ${sessao.examCode}`;
    return () => {
      document.title = base;
    };
  }, [sessao, estado]);

  const restantePausa = pausaPomodoroAte ? Math.max(0, Math.ceil((pausaPomodoroAte - agora) / 1000)) : null;
  const tarefas = dominios.find((d) => d.id === domainId)?.tarefas ?? [];

  const controles = sessao && estado && (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {estado.pausada ? (
        <Button size="lg" onClick={retomar} disabled={ocupado}>
          <Play aria-hidden />
          {restantePausa !== null && restantePausa > 0 ? "Pular intervalo" : "Retomar"}
        </Button>
      ) : (
        <Button size="lg" variant="secondary" onClick={pausar} disabled={ocupado}>
          <Pause aria-hidden />
          Pausar
        </Button>
      )}
      <Button size="lg" variant="secondary" onClick={encerrar} disabled={ocupado}>
        <Square aria-hidden />
        Encerrar
      </Button>
    </div>
  );

  const mostrador = sessao && estado && (
    <div className="grid justify-items-center gap-2 text-center">
      <p className="text-sm text-muted-foreground">
        {sessao.examCode} · {sessao.domainLabel}
        {sessao.topicLabel ? <span className="block">{sessao.topicLabel}</span> : null}
      </p>
      <p
        className={cn("tabular font-display font-extrabold tracking-tight", foco ? "text-7xl sm:text-8xl" : "text-6xl")}
        role="timer"
        aria-live="off"
        aria-label="Tempo estudado"
      >
        {formatCronometro(estado.efetivoSeg)}
      </p>
      {pomo ? (
        <p className="tabular text-sm text-muted-foreground">
          {estado.pausada && restantePausa !== null
            ? restantePausa > 0
              ? `Intervalo: ${formatCronometro(restantePausa)}`
              : "Intervalo encerrado. Retome quando quiser."
            : `Bloco ${pomo.bloco} · faltam ${formatCronometro(pomo.restanteSeg)}`}
        </p>
      ) : estado.pausada ? (
        <p className="text-sm text-muted-foreground">Pausado</p>
      ) : null}
    </div>
  );

  return (
    <>
      {sessao && estado ? (
        <Card>
          <CardContent className="grid gap-6 p-6">
            {mostrador}
            {controles}
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={() => setFoco(true)}>
                <Maximize2 aria-hidden />
                Modo foco
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Espaço pausa e retoma. Pode fechar a aba: o tempo continua contando no servidor.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nova sessão</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void iniciar();
              }}
            >
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Modo</legend>
                <div className="flex flex-wrap gap-2">
                  {(ciclo
                    ? (["LIVRE", "POMODORO", "FOCO", "CICLO"] as const)
                    : (["LIVRE", "POMODORO", "FOCO"] as const)
                  ).map((m) => (
                    <label
                      key={m}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
                        modo === m ? "border-primary-strong bg-primary-soft" : "border-input",
                      )}
                    >
                      <input
                        type="radio"
                        name="modo"
                        value={m}
                        checked={modo === m}
                        onChange={() => {
                          setModo(m);
                          if (m === "CICLO" && ciclo) {
                            setExamVersionId(ciclo.examVersionId);
                            setDomainId(ciclo.domainId);
                            setTopicId("");
                          }
                        }}
                      />
                      {m === "LIVRE"
                        ? "Livre"
                        : m === "POMODORO"
                          ? `Pomodoro ${pomodoro.trabalhoMin}/${pomodoro.pausaMin}`
                          : m === "FOCO"
                            ? "Foco (tela cheia)"
                            : `Ciclo: ${ciclo?.rotulo}`}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Exame" htmlFor="sessao-exame">
                  <NativeSelect
                    id="sessao-exame"
                    value={examVersionId}
                    onChange={(e) => {
                      setExamVersionId(e.target.value);
                      setDomainId(exames.find((x) => x.id === e.target.value)?.dominios[0]?.id ?? "");
                      setTopicId("");
                    }}
                    required
                  >
                    {exames.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.codigo}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Domínio" htmlFor="sessao-dominio">
                  <NativeSelect
                    id="sessao-dominio"
                    value={domainId}
                    onChange={(e) => {
                      setDomainId(e.target.value);
                      setTopicId("");
                    }}
                    required
                  >
                    {dominios.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.rotulo}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Tarefa (opcional)" htmlFor="sessao-tarefa">
                  <NativeSelect id="sessao-tarefa" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                    <option value="">Domínio inteiro</option>
                    {tarefas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.rotulo}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" size="lg" disabled={ocupado || !domainId}>
                  <Play aria-hidden />
                  {ocupado ? "Iniciando..." : "Iniciar"}
                </Button>
                <p className="text-xs text-muted-foreground">Atalho: Espaço</p>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {foco && sessao ? (
        <div
          ref={focoRef}
          role="dialog"
          aria-modal="true"
          aria-label="Modo foco"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-background p-6"
        >
          {mostrador}
          {controles}
          <Button variant="ghost" size="sm" onClick={() => setFoco(false)} className="absolute right-4 top-4">
            <Minimize2 aria-hidden />
            Sair (Esc)
          </Button>
        </div>
      ) : null}

      <ConfirmarTempoDialog sessao={aConfirmar} onClose={() => setAConfirmar(null)} />
    </>
  );
}
