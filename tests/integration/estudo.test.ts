import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { aplicarExame } from "@/lib/catalogo/publicacao";
import type { ExameColetado } from "@/lib/catalogo/schemas";
import { examesSeguidos, segundosPorDiaRecentes } from "@/lib/estudo/consultas";
import { definirStatusTopico, deixarDeSeguir, seguirExame } from "@/lib/estudo/servico-exames";
import {
  confirmarTempoReal,
  encerrarSessao,
  excluirSessao,
  iniciarSessao,
  lancarSessaoManual,
  obterSessaoAtiva,
  pausarSessao,
  retomarSessao,
} from "@/lib/estudo/servico-sessoes";
import { EXAMES_INICIAIS } from "../../prisma/catalogo/exames";

const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
const usuarios: string[] = [];
const slugs: string[] = [];

type Exame = { id: string; dominios: { id: string; code: string; tarefas: { id: string; code: string }[] }[] };

async function criarExame(letra: string, publicar = true): Promise<Exame> {
  const e = structuredClone(EXAMES_INICIAIS[0]) as ExameColetado;
  e.codigo = `EST${letra}-${sufixo}`;
  e.certificacao = { ...e.certificacao, slug: `estudo-${letra.toLowerCase()}-${sufixo.toLowerCase()}` };
  if (!publicar) e.precoUsd = null; // "a confirmar" → fica em revisão, fora do site
  slugs.push(e.certificacao.slug);
  await aplicarExame(db, e);
  const v = await db.examVersion.findUniqueOrThrow({
    where: { code: e.codigo },
    select: {
      id: true,
      domains: {
        where: { parentId: null },
        orderBy: { order: "asc" },
        select: { id: true, code: true, children: { orderBy: { order: "asc" }, select: { id: true, code: true } } },
      },
    },
  });
  return { id: v.id, dominios: v.domains.map((d) => ({ id: d.id, code: d.code, tarefas: d.children })) };
}

async function criarUsuario(): Promise<string> {
  const u = await db.user.create({
    data: { name: "Estudo Teste", email: `estudo-${randomUUID()}@exemplo.test`, passwordHash: "x" },
    select: { id: true },
  });
  usuarios.push(u.id);
  return u.id;
}

const minutosAtras = (m: number) => new Date(Date.now() - m * 60_000);

let exame: Exame;
let outro: Exame;
let rascunho: Exame;

beforeAll(async () => {
  exame = await criarExame("A");
  outro = await criarExame("B");
  rascunho = await criarExame("C", false);
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: usuarios } } });
  await db.examVersion.deleteMany({ where: { certification: { slug: { in: slugs } } } });
  await db.certification.deleteMany({ where: { slug: { in: slugs } } });
  await db.$disconnect();
});

describe("seguir exame", () => {
  it("só exame publicado; seguir de novo não duplica; deixar de seguir tira do escopo", async () => {
    const u = await criarUsuario();
    await expect(seguirExame(u, rascunho.id)).rejects.toThrow("Exame não encontrado.");
    await seguirExame(u, exame.id);
    await seguirExame(u, exame.id);
    expect(await db.userExam.count({ where: { userId: u } })).toBe(1);

    await deixarDeSeguir(u, exame.id);
    const d = exame.dominios[0]!;
    await expect(
      iniciarSessao(u, { examVersionId: exame.id, domainId: d.id, topicId: null, mode: "LIVRE" }),
    ).rejects.toThrow("Siga o exame antes de estudar.");
  });
});

describe("sessão cronometrada", () => {
  it("recusa domínio de outro exame e tarefa de outro domínio", async () => {
    const u = await criarUsuario();
    await seguirExame(u, exame.id);
    await expect(
      iniciarSessao(u, { examVersionId: exame.id, domainId: outro.dominios[0]!.id, topicId: null, mode: "LIVRE" }),
    ).rejects.toThrow("Domínio não encontrado.");
    await expect(
      iniciarSessao(u, {
        examVersionId: exame.id,
        domainId: exame.dominios[0]!.id,
        topicId: exame.dominios[1]!.tarefas[0]!.id,
        mode: "LIVRE",
      }),
    ).rejects.toThrow("Tarefa não encontrada.");
  });

  it("uma ativa por vez; tempo efetivo sem as pausas; tarefa passa a 'estudando'", async () => {
    const u = await criarUsuario();
    await seguirExame(u, exame.id);
    const d = exame.dominios[0]!;
    const t = d.tarefas[0]!;
    const s = await iniciarSessao(u, { examVersionId: exame.id, domainId: d.id, topicId: t.id, mode: "POMODORO" });
    expect(s).toMatchObject({ examCode: `ESTA-${sufixo}`, domainId: d.id, topicId: t.id, mode: "POMODORO" });
    await expect(
      iniciarSessao(u, { examVersionId: exame.id, domainId: d.id, topicId: null, mode: "LIVRE" }),
    ).rejects.toThrow("Você já tem uma sessão em andamento.");

    // 30 min de relógio, com 10 min de pausa.
    await db.studySession.update({ where: { id: s.id }, data: { startedAt: minutosAtras(30) } });
    await pausarSessao(u);
    await db.studyPause.updateMany({ where: { sessionId: s.id }, data: { startedAt: minutosAtras(20) } });
    await retomarSessao(u);
    await db.studyPause.updateMany({ where: { sessionId: s.id }, data: { endedAt: minutosAtras(10) } });
    const r = await encerrarSessao(u);
    expect(r.autoClosed).toBe(false);
    expect(r.durationSec).toBeGreaterThanOrEqual(20 * 60 - 2);
    expect(r.durationSec).toBeLessThanOrEqual(20 * 60 + 2);

    const status = await db.userTopic.findUniqueOrThrow({ where: { userId_topicId: { userId: u, topicId: t.id } } });
    expect(status.status).toBe("ESTUDANDO");
    expect(await obterSessaoAtiva(u)).toBeNull();
  });

  it("passou de 4h: encerra em 4h e espera o tempo real, que só o dono confirma", async () => {
    const u = await criarUsuario();
    const intruso = await criarUsuario();
    await seguirExame(u, exame.id);
    const s = await iniciarSessao(u, {
      examVersionId: exame.id,
      domainId: exame.dominios[0]!.id,
      topicId: null,
      mode: "LIVRE",
    });
    await db.studySession.update({ where: { id: s.id }, data: { startedAt: minutosAtras(5 * 60) } });

    expect(await obterSessaoAtiva(u)).toBeNull();
    const fechada = await db.studySession.findUniqueOrThrow({ where: { id: s.id } });
    expect(fechada).toMatchObject({ autoClosed: true, durationSec: 4 * 3600 });

    await expect(confirmarTempoReal(intruso, s.id, 90)).rejects.toThrow("Sessão não encontrada.");
    await confirmarTempoReal(u, s.id, 90);
    expect(await db.studySession.findUniqueOrThrow({ where: { id: s.id } })).toMatchObject({
      autoClosed: false,
      durationSec: 90 * 60,
    });
  });
});

describe("lançamento manual", () => {
  it("recusa sobreposição, mais de 4h e mais de 16h no dia; outro usuário não exclui", async () => {
    const u = await criarUsuario();
    const intruso = await criarUsuario();
    await seguirExame(u, exame.id);
    const base = { examVersionId: exame.id, domainId: exame.dominios[1]!.id, topicId: null };
    const dia = (h: number) => new Date(`2026-10-20T${String(h).padStart(2, "0")}:00:00-03:00`);

    await lancarSessaoManual(u, { ...base, inicio: dia(8), fim: dia(10) });
    await expect(lancarSessaoManual(u, { ...base, inicio: dia(9), fim: dia(11) })).rejects.toThrow(
      "Já existe uma sessão de estudo nesse horário.",
    );
    await expect(lancarSessaoManual(u, { ...base, inicio: dia(12), fim: dia(17) })).rejects.toThrow(
      "no máximo 4 horas",
    );

    for (const h of [10, 14, 18]) await lancarSessaoManual(u, { ...base, inicio: dia(h), fim: dia(h + 4) });
    await lancarSessaoManual(u, { ...base, inicio: dia(6), fim: dia(7) }); // 15h no dia
    const minutos = (h: number, m: number) => new Date(dia(h).getTime() + m * 60_000);
    await expect(lancarSessaoManual(u, { ...base, inicio: dia(22), fim: minutos(22, 61) })).rejects.toThrow("16 horas");
    await lancarSessaoManual(u, { ...base, inicio: dia(22), fim: minutos(22, 59) }); // cabe: 15h59

    const porDia = await segundosPorDiaRecentes(u, 30, new Date("2026-10-21T12:00:00-03:00"));
    expect(porDia.get("2026-10-20")).toBeLessThanOrEqual(16 * 3600);

    const umaSessao = await db.studySession.findFirstOrThrow({ where: { userId: u }, select: { id: true } });
    await expect(excluirSessao(intruso, umaSessao.id)).rejects.toThrow("Sessão não encontrada.");
    await excluirSessao(u, umaSessao.id);
  });
});

describe("progresso", () => {
  it("status só em exame seguido; exame ponderado pelos pesos do blueprint", async () => {
    const u = await criarUsuario();
    await expect(definirStatusTopico(u, exame.dominios[0]!.tarefas[0]!.id, "CONCLUIDO")).rejects.toThrow(
      "Tarefa não encontrada.",
    );
    await seguirExame(u, exame.id);
    // Domínio 4 (peso 12) inteiro concluído; domínio 1 (peso 24) com 2 de 4.
    for (const t of exame.dominios[3]!.tarefas) await definirStatusTopico(u, t.id, "CONCLUIDO");
    for (const t of exame.dominios[0]!.tarefas.slice(0, 2)) await definirStatusTopico(u, t.id, "REVISAR");

    const [e] = await examesSeguidos(u);
    expect(e!.dominios[3]!.progresso).toMatchObject({ concluidos: 3, total: 3, pct: 100 });
    expect(e!.dominios[0]!.progresso).toMatchObject({ concluidos: 2, total: 4, pct: 50 });
    expect(e!.pct).toBe(Math.round(((12 * 1 + 24 * 0.5) / 100) * 100));

    const t = exame.dominios[3]!.tarefas[0]!;
    await definirStatusTopico(u, t.id, "NAO_INICIADO");
    const linha = await db.userTopic.findUniqueOrThrow({ where: { userId_topicId: { userId: u, topicId: t.id } } });
    expect(linha.completedAt).toBeNull();
  });
});
