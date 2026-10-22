import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { StudyMode } from "@/generated/prisma/client";
import { ehViolacaoUnica, type Executor } from "./acao";
import { assertDominioDoExame, assertTopicoDoDominio } from "./acesso";
import { statusAoEstudar } from "./progresso";
import {
  LIMITE_DIARIO_SEG,
  MAX_SESSAO_SEG,
  ajustarAoLimiteDiario,
  calcularEncerramento,
  estadoSessao,
  segundosPorDia,
  validarLancamentoManual,
  type SessaoComDuracao,
} from "./sessoes";
import { getDayKey, inicioDoDia, inicioDoDiaMais } from "./tempo";

const incluirAtiva = {
  pauses: { select: { id: true, startedAt: true, endedAt: true }, orderBy: { startedAt: "asc" as const } },
  examVersion: { select: { code: true } },
  domain: { select: { code: true, nameEn: true, namePt: true } },
  topic: { select: { code: true, nameEn: true, namePt: true } },
};

type RotuloDominio = { code: string; nameEn: string; namePt: string | null };
/** Mesmo rótulo das listas: "1. Domínio" e "1.1 Tarefa". */
const rotulo = (d: RotuloDominio) => `${d.code}${d.code.includes(".") ? "" : "."} ${d.namePt ?? d.nameEn}`;

export type SessaoAtivaDTO = {
  id: string;
  examCode: string;
  domainId: string;
  domainLabel: string;
  topicId: string | null;
  topicLabel: string | null;
  mode: StudyMode;
  startedAt: string;
  pausas: { startedAt: string; endedAt: string | null }[];
  serverNow: string;
};

/** Bloqueia a linha do usuário: serializa toda escrita de sessões dele. */
async function travarUsuario(tx: Executor, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

/** Sessões (encerradas e a ativa) que tocam os dias de [inicio, fim], para checar conflitos. */
async function sessoesNosDias(tx: Executor, userId: string, inicio: Date, fim: Date, agora: Date, excetoId?: string) {
  const desde = inicioDoDia(inicio);
  const ate = inicioDoDiaMais(fim, 1);
  const linhas = await tx.studySession.findMany({
    where: {
      userId,
      ...(excetoId ? { id: { not: excetoId } } : {}),
      startedAt: { lt: ate },
      OR: [{ endedAt: null }, { endedAt: { gt: desde } }],
    },
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      durationSec: true,
      pauses: { select: { startedAt: true, endedAt: true } },
    },
  });
  return linhas.map<SessaoComDuracao>((s) =>
    s.endedAt
      ? { inicio: s.startedAt, fim: s.endedAt, durationSec: s.durationSec ?? 0 }
      : {
          inicio: s.startedAt,
          fim: agora,
          durationSec: estadoSessao({ startedAt: s.startedAt, pauses: s.pauses }, agora).efetivoSeg,
        },
  );
}

async function marcarTopicoEmEstudo(tx: Executor, userId: string, topicId: string | null) {
  if (!topicId) return;
  const atual = await tx.userTopic.findUnique({
    where: { userId_topicId: { userId, topicId } },
    select: { status: true },
  });
  const novo = statusAoEstudar(atual?.status ?? "NAO_INICIADO");
  if (!atual) await tx.userTopic.create({ data: { userId, topicId, status: novo } });
  else if (atual.status !== novo)
    await tx.userTopic.update({ where: { userId_topicId: { userId, topicId } }, data: { status: novo } });
}

function paraDTO(
  s: {
    id: string;
    domainId: string;
    topicId: string | null;
    mode: StudyMode;
    startedAt: Date;
    pauses: { startedAt: Date; endedAt: Date | null }[];
    examVersion: { code: string };
    domain: RotuloDominio;
    topic: RotuloDominio | null;
  },
  agora: Date,
): SessaoAtivaDTO {
  return {
    id: s.id,
    examCode: s.examVersion.code,
    domainId: s.domainId,
    domainLabel: rotulo(s.domain),
    topicId: s.topicId,
    topicLabel: s.topic ? rotulo(s.topic) : null,
    mode: s.mode,
    startedAt: s.startedAt.toISOString(),
    pausas: s.pauses.map((p) => ({ startedAt: p.startedAt.toISOString(), endedAt: p.endedAt?.toISOString() ?? null })),
    serverNow: agora.toISOString(),
  };
}

/**
 * Sessão ativa do usuário, já reconciliada com o servidor: se passou de 4h
 * efetivas (aba fechada, por exemplo), é encerrada em 4h e fica aguardando
 * confirmação do tempo real.
 */
export async function obterSessaoAtiva(userId: string): Promise<SessaoAtivaDTO | null> {
  const agora = new Date();
  const s = await db.studySession.findFirst({ where: { userId, endedAt: null }, include: incluirAtiva });
  if (!s) return null;
  if (estadoSessao(s, agora).excedeuLimite) {
    await encerrarSessao(userId);
    return null;
  }
  return paraDTO(s, agora);
}

export async function iniciarSessao(
  userId: string,
  input: { examVersionId: string; domainId: string; topicId: string | null; mode: StudyMode },
): Promise<SessaoAtivaDTO> {
  await assertDominioDoExame(userId, input.examVersionId, input.domainId);
  if (input.topicId) await assertTopicoDoDominio(input.domainId, input.topicId);
  const agora = new Date();
  try {
    return await db.$transaction(async (tx) => {
      await travarUsuario(tx, userId);
      const ativa = await tx.studySession.findFirst({ where: { userId, endedAt: null }, select: { id: true } });
      if (ativa) throw new AppError("Você já tem uma sessão em andamento.", "sessao_ativa");
      const hoje = segundosPorDia(await sessoesNosDias(tx, userId, agora, agora, agora)).get(getDayKey(agora)) ?? 0;
      if (hoje >= LIMITE_DIARIO_SEG)
        throw new AppError("Você já atingiu o limite de 16 horas de estudo hoje.", "limite16h");
      const conflito = await tx.studySession.findFirst({
        where: { userId, startedAt: { lte: agora }, endedAt: { gt: agora } },
        select: { id: true },
      });
      if (conflito) throw new AppError("Já existe uma sessão de estudo nesse horário.", "sobreposicao");
      const criada = await tx.studySession.create({
        data: {
          userId,
          examVersionId: input.examVersionId,
          domainId: input.domainId,
          topicId: input.topicId,
          mode: input.mode,
          startedAt: agora,
        },
        include: incluirAtiva,
      });
      await marcarTopicoEmEstudo(tx, userId, input.topicId);
      return paraDTO(criada, agora);
    });
  } catch (e) {
    if (ehViolacaoUnica(e)) throw new AppError("Você já tem uma sessão em andamento.", "sessao_ativa");
    throw e;
  }
}

async function sessaoAtivaOuErro(tx: Executor, userId: string) {
  const s = await tx.studySession.findFirst({ where: { userId, endedAt: null }, include: incluirAtiva });
  if (!s) throw new AppError("Nenhuma sessão em andamento.", "sem_sessao");
  return s;
}

export async function pausarSessao(userId: string): Promise<SessaoAtivaDTO | null> {
  const agora = new Date();
  const s = await db.$transaction(async (tx) => {
    await travarUsuario(tx, userId);
    const s = await sessaoAtivaOuErro(tx, userId);
    if (estadoSessao(s, agora).excedeuLimite) return null;
    if (!s.pauses.some((p) => p.endedAt === null)) {
      await tx.studyPause.create({ data: { sessionId: s.id, startedAt: agora } });
    }
    return tx.studySession.findUniqueOrThrow({ where: { id: s.id }, include: incluirAtiva });
  });
  if (!s) {
    await encerrarSessao(userId);
    return null;
  }
  return paraDTO(s, agora);
}

export async function retomarSessao(userId: string): Promise<SessaoAtivaDTO> {
  const agora = new Date();
  const s = await db.$transaction(async (tx) => {
    await travarUsuario(tx, userId);
    const s = await sessaoAtivaOuErro(tx, userId);
    await tx.studyPause.updateMany({ where: { sessionId: s.id, endedAt: null }, data: { endedAt: agora } });
    return tx.studySession.findUniqueOrThrow({ where: { id: s.id }, include: incluirAtiva });
  });
  return paraDTO(s, agora);
}

export type ResultadoEncerramento = { id: string; durationSec: number; autoClosed: boolean; ajustadaAoLimite: boolean };

/** Encerra a sessão ativa (duração efetiva sem pausas, máx. 4h, cabe nas 16h do dia). */
export async function encerrarSessao(userId: string): Promise<ResultadoEncerramento> {
  const agora = new Date();
  return db.$transaction(async (tx) => {
    await travarUsuario(tx, userId);
    const s = await sessaoAtivaOuErro(tx, userId);
    const enc = calcularEncerramento(s, agora);
    const outras = await sessoesNosDias(tx, userId, s.startedAt, enc.endedAt, agora, s.id);
    const durationSec = ajustarAoLimiteDiario(
      { inicio: s.startedAt, fim: enc.endedAt, durationSec: enc.durationSec },
      outras,
    );
    await tx.studyPause.updateMany({ where: { sessionId: s.id, endedAt: null }, data: { endedAt: enc.endedAt } });
    await tx.studySession.update({
      where: { id: s.id },
      data: { endedAt: enc.endedAt, durationSec, autoClosed: enc.autoClosed },
    });
    return { id: s.id, durationSec, autoClosed: enc.autoClosed, ajustadaAoLimite: durationSec < enc.durationSec };
  });
}

/** Sessões encerradas automaticamente em 4h aguardando o tempo real. */
export async function sessoesAConfirmar(userId: string) {
  return db.studySession.findMany({
    where: { userId, autoClosed: true },
    select: {
      id: true,
      startedAt: true,
      durationSec: true,
      examVersion: { select: { code: true } },
      domain: { select: { code: true, nameEn: true, namePt: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 5,
  });
}

/** O usuário informa quanto realmente estudou (até 4h) numa sessão encerrada automaticamente. */
export async function confirmarTempoReal(userId: string, sessionId: string, minutos: number) {
  const segundos = Math.round(minutos * 60);
  if (segundos < 0 || segundos > MAX_SESSAO_SEG) throw new AppError("Informe um tempo entre 0 e 4 horas.", "validacao");
  await db.$transaction(async (tx) => {
    await travarUsuario(tx, userId);
    const s = await tx.studySession.findFirst({
      where: { id: sessionId, userId, autoClosed: true },
      select: { id: true },
    });
    if (!s) throw new AppError("Sessão não encontrada.", "nao_encontrado");
    await tx.studySession.update({ where: { id: s.id }, data: { durationSec: segundos, autoClosed: false } });
  });
}

/** Lançamento manual (estudo offline): máx. 4h, sem sobreposição, máx. 16h no dia. */
export async function lancarSessaoManual(
  userId: string,
  input: { examVersionId: string; domainId: string; topicId: string | null; inicio: Date; fim: Date },
) {
  await assertDominioDoExame(userId, input.examVersionId, input.domainId);
  if (input.topicId) await assertTopicoDoDominio(input.domainId, input.topicId);
  const agora = new Date();
  await db.$transaction(async (tx) => {
    await travarUsuario(tx, userId);
    const existentes = await sessoesNosDias(tx, userId, input.inicio, input.fim, agora);
    const erro = validarLancamentoManual({ inicio: input.inicio, fim: input.fim }, existentes, agora);
    if (erro) throw new AppError(erro.message, erro.code);
    const durationSec = Math.floor((input.fim.getTime() - input.inicio.getTime()) / 1000);
    await tx.studySession.create({
      data: {
        userId,
        examVersionId: input.examVersionId,
        domainId: input.domainId,
        topicId: input.topicId,
        mode: "LIVRE",
        manual: true,
        startedAt: input.inicio,
        endedAt: input.fim,
        durationSec,
      },
    });
    await marcarTopicoEmEstudo(tx, userId, input.topicId);
  });
}

/** Exclui uma sessão (a ativa é descartada). */
export async function excluirSessao(userId: string, sessionId: string) {
  await db.$transaction(async (tx) => {
    await travarUsuario(tx, userId);
    const s = await tx.studySession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!s) throw new AppError("Sessão não encontrada.", "nao_encontrado");
    await tx.studySession.delete({ where: { id: s.id } });
  });
}
