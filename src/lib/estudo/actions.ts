"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { executar } from "./acao";
import * as exames from "./servico-exames";
import * as sessoes from "./servico-sessoes";
import { STATUS_TOPICO } from "./progresso";

const id = z.string().min(1).max(64);
const idOpcional = z
  .string()
  .max(64)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

function atualizar() {
  revalidatePath("/", "layout");
}

// ───────────────────────────── Exames ─────────────────────────────

export async function seguirExameAction(examVersionId: string) {
  const user = await requireUser();
  return executar("exame.seguir", async () => {
    await exames.seguirExame(user.id, id.parse(examVersionId));
    atualizar();
  });
}

export async function deixarDeSeguirAction(examVersionId: string) {
  const user = await requireUser();
  return executar("exame.deixar", async () => {
    await exames.deixarDeSeguir(user.id, id.parse(examVersionId));
    atualizar();
  });
}

const dataProvaSchema = z.object({
  examVersionId: id,
  data: z
    .union([z.literal(""), z.iso.date({ error: "Informe uma data válida." })])
    .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null)),
});

export async function definirDataProvaAction(input: z.input<typeof dataProvaSchema>) {
  const user = await requireUser();
  return executar("exame.data", async () => {
    const d = dataProvaSchema.parse(input);
    await exames.definirDataProva(user.id, d.examVersionId, d.data);
    atualizar();
  });
}

const statusSchema = z.object({ topicId: id, status: z.enum(STATUS_TOPICO) });

export async function definirStatusTopicoAction(input: z.input<typeof statusSchema>) {
  const user = await requireUser();
  return executar("topico.status", async () => {
    const d = statusSchema.parse(input);
    await exames.definirStatusTopico(user.id, d.topicId, d.status);
    atualizar();
  });
}

// ───────────────────────────── Sessões ─────────────────────────────

const iniciarSchema = z.object({
  examVersionId: id,
  domainId: id,
  topicId: idOpcional,
  mode: z.enum(["LIVRE", "POMODORO", "FOCO"]),
});

export async function iniciarSessaoAction(input: z.input<typeof iniciarSchema>) {
  const user = await requireUser();
  return executar("sessao.iniciar", async () => {
    const r = await sessoes.iniciarSessao(user.id, iniciarSchema.parse(input));
    atualizar();
    return r;
  });
}

export async function pausarSessaoAction() {
  const user = await requireUser();
  return executar("sessao.pausar", () => sessoes.pausarSessao(user.id));
}

export async function retomarSessaoAction() {
  const user = await requireUser();
  return executar("sessao.retomar", () => sessoes.retomarSessao(user.id));
}

export async function encerrarSessaoAction() {
  const user = await requireUser();
  return executar("sessao.encerrar", async () => {
    const r = await sessoes.encerrarSessao(user.id);
    atualizar();
    return r;
  });
}

/** Estado atual da sessão no servidor (usado ao voltar para a aba). */
export async function sessaoAtivaAction() {
  const user = await requireUser();
  return executar("sessao.ativa", () => sessoes.obterSessaoAtiva(user.id));
}

const confirmarSchema = z.object({ sessionId: id, minutos: z.coerce.number().int().min(0).max(240) });

export async function confirmarTempoRealAction(input: z.input<typeof confirmarSchema>) {
  const user = await requireUser();
  return executar("sessao.confirmar", async () => {
    const d = confirmarSchema.parse(input);
    await sessoes.confirmarTempoReal(user.id, d.sessionId, d.minutos);
    atualizar();
  });
}

const manualSchema = z
  .object({
    examVersionId: id,
    domainId: id,
    topicId: idOpcional,
    dia: z.iso.date({ error: "Informe o dia." }),
    inicio: z.string().regex(/^\d{2}:\d{2}$/, "Informe o horário de início."),
    fim: z.string().regex(/^\d{2}:\d{2}$/, "Informe o horário de fim."),
  })
  .transform((v) => {
    // Horários informados em São Paulo (UTC−3, sem horário de verão desde 2019).
    const inicio = new Date(`${v.dia}T${v.inicio}:00-03:00`);
    let fim = new Date(`${v.dia}T${v.fim}:00-03:00`);
    if (fim <= inicio) fim = new Date(fim.getTime() + 86_400_000); // atravessou a meia-noite
    return { examVersionId: v.examVersionId, domainId: v.domainId, topicId: v.topicId, inicio, fim };
  });

export async function lancarManualAction(input: z.input<typeof manualSchema>) {
  const user = await requireUser();
  return executar("sessao.manual", async () => {
    await sessoes.lancarSessaoManual(user.id, manualSchema.parse(input));
    atualizar();
  });
}

export async function excluirSessaoAction(sessionId: string) {
  const user = await requireUser();
  return executar("sessao.excluir", async () => {
    await sessoes.excluirSessao(user.id, id.parse(sessionId));
    atualizar();
  });
}

// ─────────────────────────── Preferências ───────────────────────────

const metaSchema = z.object({
  dailyGoalMin: z.coerce
    .number()
    .int()
    .min(10, "Mínimo de 10 minutos.")
    .max(16 * 60, "Máximo de 16 horas."),
  streakMinMin: z.coerce.number().int().min(5, "Mínimo de 5 minutos.").max(240, "Máximo de 4 horas."),
});

export async function salvarMetaAction(input: z.input<typeof metaSchema>) {
  const user = await requireUser();
  return executar("preferencias.meta", async () => {
    await db.user.update({ where: { id: user.id }, data: metaSchema.parse(input) });
    atualizar();
  });
}

const pomodoroSchema = z.object({
  pomodoroWorkMin: z.coerce.number().int().min(5).max(120),
  pomodoroBreakMin: z.coerce.number().int().min(1).max(60),
  pomodoroLongMin: z.coerce.number().int().min(1).max(90),
  pomodoroLongEvery: z.coerce.number().int().min(2).max(12),
});

export async function salvarPomodoroAction(input: z.input<typeof pomodoroSchema>) {
  const user = await requireUser();
  return executar("preferencias.pomodoro", async () => {
    await db.user.update({ where: { id: user.id }, data: pomodoroSchema.parse(input) });
    atualizar();
  });
}
