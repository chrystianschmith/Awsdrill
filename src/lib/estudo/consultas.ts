import "server-only";
import { db } from "@/lib/db";
import { VERSAO_VISIVEL } from "@/lib/catalogo/consultas";
import type { TopicStatus } from "@/generated/prisma/client";
import { progressoDominio, progressoExame, type Progresso } from "./progresso";
import { estadoSessao, segundosPorDia, type SessaoComDuracao } from "./sessoes";
import { getDayKey, inicioDoDiaMais } from "./tempo";

/** Sessões encerradas (e a ativa, até agora) desde `desde`, com tempo efetivo. */
export async function sessoesComDuracao(
  userId: string,
  desde: Date | null,
  agora = new Date(),
): Promise<SessaoComDuracao[]> {
  const linhas = await db.studySession.findMany({
    where: { userId, ...(desde ? { OR: [{ endedAt: null }, { endedAt: { gt: desde } }] } : {}) },
    select: {
      startedAt: true,
      endedAt: true,
      durationSec: true,
      pauses: { select: { startedAt: true, endedAt: true } },
    },
  });
  return linhas.map((s) =>
    s.endedAt
      ? { inicio: s.startedAt, fim: s.endedAt, durationSec: s.durationSec ?? 0 }
      : {
          inicio: s.startedAt,
          fim: agora,
          durationSec: estadoSessao({ startedAt: s.startedAt, pauses: s.pauses }, agora).efetivoSeg,
        },
  );
}

/** Segundos por dia de São Paulo nos últimos `dias` dias (para meta e streak). */
export async function segundosPorDiaRecentes(userId: string, dias: number, agora = new Date()) {
  const desde = inicioDoDiaMais(agora, -dias);
  return segundosPorDia(await sessoesComDuracao(userId, desde, agora));
}

export async function preferenciasDeEstudo(userId: string) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      dailyGoalMin: true,
      streakMinMin: true,
      pomodoroWorkMin: true,
      pomodoroBreakMin: true,
      pomodoroLongMin: true,
      pomodoroLongEvery: true,
    },
  });
}

export type TarefaComStatus = { id: string; codigo: string; nome: string; nomeEn: string; status: TopicStatus };
export type DominioComProgresso = {
  id: string;
  codigo: string;
  nome: string;
  peso: number | null;
  progresso: Progresso;
  tarefas: TarefaComStatus[];
};
export type ExameSeguido = {
  examVersionId: string;
  codigo: string;
  nome: string;
  slug: string;
  dataProva: Date | null;
  pct: number;
  dominios: DominioComProgresso[];
};

/** Exames seguidos, com domínios vigentes, peso da última revisão e status de cada tarefa. */
export async function examesSeguidos(userId: string): Promise<ExameSeguido[]> {
  const seguidos = await db.userExam.findMany({
    where: { userId, status: "ATIVO", examVersion: VERSAO_VISIVEL },
    orderBy: { createdAt: "asc" },
    select: {
      examDate: true,
      examVersion: {
        select: {
          id: true,
          code: true,
          certification: { select: { name: true, slug: true } },
          domains: {
            where: { parentId: null, retiredAt: null },
            orderBy: { order: "asc" },
            select: {
              id: true,
              code: true,
              nameEn: true,
              namePt: true,
              weights: { orderBy: { revision: "desc" }, take: 1, select: { weightPct: true } },
              children: {
                where: { retiredAt: null },
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  code: true,
                  nameEn: true,
                  namePt: true,
                  userTopics: { where: { userId }, select: { status: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  return seguidos.map(({ examDate, examVersion: v }) => {
    const dominios = v.domains.map<DominioComProgresso>((d) => {
      const tarefas = d.children.map<TarefaComStatus>((t) => ({
        id: t.id,
        codigo: t.code,
        nome: t.namePt ?? t.nameEn,
        nomeEn: t.nameEn,
        status: t.userTopics[0]?.status ?? "NAO_INICIADO",
      }));
      return {
        id: d.id,
        codigo: d.code,
        nome: d.namePt ?? d.nameEn,
        peso: d.weights[0]?.weightPct?.toNumber() ?? null,
        progresso: progressoDominio(tarefas.map((t) => t.status)),
        tarefas,
      };
    });
    return {
      examVersionId: v.id,
      codigo: v.code,
      nome: v.certification.name,
      slug: v.certification.slug,
      dataProva: examDate,
      pct: progressoExame(dominios.map((d) => ({ peso: d.peso, ...d.progresso }))),
      dominios,
    };
  });
}

/** Exames publicados que o usuário ainda não segue. */
export async function examesParaSeguir(userId: string) {
  const versoes = await db.examVersion.findMany({
    where: { ...VERSAO_VISIVEL, followers: { none: { userId, status: "ATIVO" } } },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      certification: { select: { name: true, level: true, trackOrder: true } },
      followers: { where: { userId }, select: { id: true }, take: 1 },
    },
  });
  // Pausado = seguido antes de voltar ao Grátis; o progresso está guardado.
  return versoes.map((v) => ({
    id: v.id,
    codigo: v.code,
    nome: v.certification.name,
    pausado: v.followers.length > 0,
  }));
}

export type OpcaoExame = {
  id: string;
  codigo: string;
  dominios: { id: string; rotulo: string; tarefas: { id: string; rotulo: string }[] }[];
};

/** Exame → domínio → tarefa, para o timer e o lançamento manual. */
export async function opcoesDeEstudo(userId: string): Promise<OpcaoExame[]> {
  const exames = await examesSeguidos(userId);
  return exames.map((e) => ({
    id: e.examVersionId,
    codigo: e.codigo,
    dominios: e.dominios.map((d) => ({
      id: d.id,
      rotulo: `${d.codigo}. ${d.nome}`,
      tarefas: d.tarefas.map((t) => ({ id: t.id, rotulo: `${t.codigo} ${t.nome}` })),
    })),
  }));
}

/** Últimas sessões encerradas. */
export async function historicoSessoes(userId: string, take = 20) {
  return db.studySession.findMany({
    where: { userId, endedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take,
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      durationSec: true,
      manual: true,
      mode: true,
      autoClosed: true,
      examVersion: { select: { code: true } },
      domain: { select: { code: true, nameEn: true, namePt: true } },
      topic: { select: { code: true, nameEn: true, namePt: true } },
    },
  });
}

/** Prova mais próxima entre os exames seguidos. */
export function proximaProva(exames: ExameSeguido[], agora = new Date()) {
  // A data da prova é um dia (00:00 UTC); compara com o dia de hoje em São Paulo.
  const hoje = getDayKey(agora);
  const futuras = exames
    .filter((e) => e.dataProva && e.dataProva.toISOString().slice(0, 10) >= hoje)
    .sort((a, b) => a.dataProva!.getTime() - b.dataProva!.getTime());
  return futuras[0] ?? null;
}
