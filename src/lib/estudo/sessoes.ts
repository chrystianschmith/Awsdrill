import { dividirPorDia } from "./tempo";

/** Duração máxima de uma sessão (cronometrada ou lançamento manual). */
export const MAX_SESSAO_SEG = 4 * 3600;
/** Limite de estudo somado em um dia de São Paulo. */
export const LIMITE_DIARIO_SEG = 16 * 3600;
/** Tolerância para relógios levemente adiantados em lançamentos manuais. */
const TOLERANCIA_FUTURO_MS = 60_000;

export type Intervalo = { inicio: Date; fim: Date };
export type Pausa = { startedAt: Date; endedAt: Date | null };

/** Sessão com tempo efetivo conhecido, usada nas estatísticas por dia. */
export type SessaoComDuracao = { inicio: Date; fim: Date; durationSec: number };

/** Segundos de `pausa` que caem dentro de [inicio, fim]; pausa aberta vai até `fim`. */
function sobreposicaoPausa(pausa: Pausa, inicio: number, fim: number): number {
  const a = Math.max(pausa.startedAt.getTime(), inicio);
  const b = Math.min((pausa.endedAt ?? new Date(fim)).getTime(), fim);
  return Math.max(0, b - a);
}

/** Tempo efetivo (sem pausas) entre o início da sessão e `fim`, em segundos. */
export function duracaoEfetivaSeg(startedAt: Date, fim: Date, pausas: Pausa[]): number {
  const inicio = startedAt.getTime();
  const final = fim.getTime();
  if (final <= inicio) return 0;
  const pausado = pausas.reduce((soma, p) => soma + sobreposicaoPausa(p, inicio, final), 0);
  return Math.max(0, Math.floor((final - inicio - pausado) / 1000));
}

/**
 * Instante em que o tempo efetivo atingiu `limiteSeg`, percorrendo os trechos
 * entre pausas. Retorna null se ainda não atingiu até `agora`.
 */
export function momentoDoLimite(startedAt: Date, pausas: Pausa[], limiteSeg: number, agora: Date): Date | null {
  const ordenadas = [...pausas].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  let cursor = startedAt.getTime();
  let restanteMs = limiteSeg * 1000;
  const fim = agora.getTime();
  for (const p of ordenadas) {
    const pInicio = Math.max(p.startedAt.getTime(), cursor);
    const trecho = Math.min(pInicio, fim) - cursor;
    if (trecho >= restanteMs) return new Date(cursor + restanteMs);
    restanteMs -= Math.max(0, trecho);
    const pFim = p.endedAt ? p.endedAt.getTime() : fim;
    cursor = Math.max(cursor, pFim);
    if (cursor >= fim) return null;
  }
  if (fim - cursor >= restanteMs) return new Date(cursor + restanteMs);
  return null;
}

export type EstadoSessao = {
  efetivoSeg: number;
  pausada: boolean;
  pausadaDesde: Date | null;
  /** Passou de 4h efetivas: precisa ser encerrada automaticamente. */
  excedeuLimite: boolean;
};

export function estadoSessao(s: { startedAt: Date; pauses: Pausa[] }, agora: Date): EstadoSessao {
  const aberta = s.pauses.find((p) => p.endedAt === null) ?? null;
  const efetivoSeg = duracaoEfetivaSeg(s.startedAt, agora, s.pauses);
  return {
    efetivoSeg,
    pausada: aberta !== null,
    pausadaDesde: aberta?.startedAt ?? null,
    excedeuLimite: efetivoSeg > MAX_SESSAO_SEG,
  };
}

export type Encerramento = { endedAt: Date; durationSec: number; autoClosed: boolean };

/**
 * Calcula o encerramento de uma sessão cronometrada. Acima de 4h efetivas a
 * sessão é encerrada no instante em que completou 4h e marcada para o usuário
 * confirmar o tempo real.
 */
export function calcularEncerramento(s: { startedAt: Date; pauses: Pausa[] }, agora: Date): Encerramento {
  const efetivo = duracaoEfetivaSeg(s.startedAt, agora, s.pauses);
  if (efetivo <= MAX_SESSAO_SEG) {
    const ultimaPausaAberta = s.pauses.find((p) => p.endedAt === null);
    // Encerrar durante uma pausa: o fim é o início da pausa (o resto não é estudo).
    const endedAt = ultimaPausaAberta ? ultimaPausaAberta.startedAt : agora;
    return { endedAt: endedAt < s.startedAt ? s.startedAt : endedAt, durationSec: efetivo, autoClosed: false };
  }
  const limite = momentoDoLimite(s.startedAt, s.pauses, MAX_SESSAO_SEG, agora) ?? agora;
  return { endedAt: limite, durationSec: MAX_SESSAO_SEG, autoClosed: true };
}

export function intervalosSobrepoem(a: Intervalo, b: Intervalo): boolean {
  return a.inicio.getTime() < b.fim.getTime() && b.inicio.getTime() < a.fim.getTime();
}

export function existeSobreposicao(novo: Intervalo, existentes: Intervalo[]): boolean {
  return existentes.some((e) => intervalosSobrepoem(novo, e));
}

/**
 * Segundos efetivos por dia de São Paulo. Sessões que atravessam a meia-noite
 * são divididas proporcionalmente ao tempo de relógio em cada dia.
 */
export function segundosPorDia(sessoes: SessaoComDuracao[]): Map<string, number> {
  const total = new Map<string, number>();
  for (const s of sessoes) {
    const partes = dividirPorDia(s.inicio, s.fim);
    const relogio = [...partes.values()].reduce((a, b) => a + b, 0);
    if (relogio <= 0) continue;
    const fator = Math.min(1, s.durationSec / relogio);
    for (const [dia, seg] of partes) total.set(dia, (total.get(dia) ?? 0) + seg * fator);
  }
  for (const [dia, seg] of total) total.set(dia, Math.round(seg));
  return total;
}

/** Excedente (segundos) acima do limite diário se `novo` for gravado; 0 = cabe. */
export function excedenteDiario(
  novo: SessaoComDuracao,
  existentes: SessaoComDuracao[],
): { dia: string; excedenteSeg: number } | null {
  const atuais = segundosPorDia(existentes);
  const novos = segundosPorDia([novo]);
  let pior: { dia: string; excedenteSeg: number } | null = null;
  for (const [dia, seg] of novos) {
    const excedente = (atuais.get(dia) ?? 0) + seg - LIMITE_DIARIO_SEG;
    if (excedente > 0 && (!pior || excedente > pior.excedenteSeg)) pior = { dia, excedenteSeg: excedente };
  }
  return pior;
}

export type ErroSessao = { code: "intervalo" | "futuro" | "max4h" | "sobreposicao" | "limite16h"; message: string };

/** Valida um lançamento manual (sem tocar no banco). */
export function validarLancamentoManual(
  novo: Intervalo,
  existentes: SessaoComDuracao[],
  agora: Date,
): ErroSessao | null {
  const dur = (novo.fim.getTime() - novo.inicio.getTime()) / 1000;
  if (dur < 60) return { code: "intervalo", message: "O fim precisa ser pelo menos 1 minuto depois do início." };
  if (novo.fim.getTime() > agora.getTime() + TOLERANCIA_FUTURO_MS) {
    return { code: "futuro", message: "Não é possível lançar estudo no futuro." };
  }
  if (dur > MAX_SESSAO_SEG) return { code: "max4h", message: "Cada lançamento manual pode ter no máximo 4 horas." };
  return validarConflitos({ ...novo, durationSec: Math.floor(dur) }, existentes);
}

/** Checa sobreposição e limite diário de 16h para uma sessão nova. */
export function validarConflitos(novo: SessaoComDuracao, existentes: SessaoComDuracao[]): ErroSessao | null {
  if (existeSobreposicao(novo, existentes)) {
    return { code: "sobreposicao", message: "Já existe uma sessão de estudo nesse horário." };
  }
  if (excedenteDiario(novo, existentes)) {
    return { code: "limite16h", message: "O limite é de 16 horas de estudo por dia." };
  }
  return null;
}

/**
 * Ajusta a duração de uma sessão cronometrada para não passar das 16h no dia.
 * Retorna a duração final (pode ser menor que a original).
 */
export function ajustarAoLimiteDiario(novo: SessaoComDuracao, existentes: SessaoComDuracao[]): number {
  const exc = excedenteDiario(novo, existentes);
  if (!exc) return novo.durationSec;
  return Math.max(0, novo.durationSec - exc.excedenteSeg);
}

// ───────────────────────────── Pomodoro ─────────────────────────────

export type PomodoroCfg = { trabalhoMin: number; pausaMin: number; pausaLongaMin: number; longaACada: number };

export const POMODORO_PADRAO: PomodoroCfg = { trabalhoMin: 25, pausaMin: 5, pausaLongaMin: 15, longaACada: 4 };

/** Bloco atual do Pomodoro a partir do tempo efetivo estudado. */
export function estadoPomodoro(
  efetivoSeg: number,
  cfg: PomodoroCfg,
): { bloco: number; restanteSeg: number; concluidos: number } {
  const blocoSeg = cfg.trabalhoMin * 60;
  const concluidos = Math.floor(efetivoSeg / blocoSeg);
  return { bloco: concluidos + 1, restanteSeg: blocoSeg - (efetivoSeg % blocoSeg), concluidos };
}

/** Duração da pausa depois de `concluidos` blocos (longa a cada N blocos). */
export function duracaoPausaSeg(concluidos: number, cfg: PomodoroCfg): number {
  const longa = concluidos > 0 && concluidos % cfg.longaACada === 0;
  return (longa ? cfg.pausaLongaMin : cfg.pausaMin) * 60;
}
