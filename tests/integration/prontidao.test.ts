import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { aplicarExame } from "@/lib/catalogo/publicacao";
import type { ExameColetado } from "@/lib/catalogo/schemas";
import { previaCiclo } from "@/lib/estudo/servico-ciclo";
import { seguirExame } from "@/lib/estudo/servico-exames";
import { prontidaoDoExame } from "@/lib/prontidao/servico";
import { importarQuestoes, moderarQuestoes } from "@/lib/simulados/importacao";
import { enviarSimulado, iniciarSimulado, obterSimulado, responder } from "@/lib/simulados/servico";
import { EXAMES_INICIAIS } from "../../prisma/catalogo/exames";
import { arquivoFicticio } from "../apoio/questoes";

const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
const usuarios: string[] = [];
let exame: { id: string; codigo: string; slug: string; dominios: string[] };

async function criarUsuario(): Promise<string> {
  const u = await db.user.create({
    data: { name: "Prontidão Teste", email: `pront-${randomUUID()}@exemplo.test`, passwordHash: "x" },
    select: { id: true },
  });
  usuarios.push(u.id);
  await seguirExame(u.id, exame.id);
  return u.id;
}

/** Faz um treino só no domínio, acertando ou errando tudo. */
async function treinar(userId: string, domainId: string, certo: boolean) {
  const s = await iniciarSimulado(userId, {
    examVersionId: exame.id,
    mode: "TREINO",
    quantidade: 10,
    domainIds: [domainId],
  });
  for (const q of (await obterSimulado(userId, s.id)).questoes) {
    const { correctKeys } = await db.question.findUniqueOrThrow({ where: { id: q.id }, select: { correctKeys: true } });
    await responder(userId, s.id, q.id, certo ? correctKeys : correctKeys.length === 1 ? ["B"] : ["B", "D"]);
  }
  await enviarSimulado(userId, s.id);
  return s.id;
}

beforeAll(async () => {
  const e = structuredClone(EXAMES_INICIAIS[0]) as ExameColetado;
  e.codigo = `PRO-${sufixo}`;
  e.certificacao = { ...e.certificacao, slug: `pront-${sufixo.toLowerCase()}` };
  await aplicarExame(db, e);
  const v = await db.examVersion.findUniqueOrThrow({
    where: { code: e.codigo },
    select: { id: true, domains: { where: { parentId: null }, orderBy: { order: "asc" }, select: { id: true } } },
  });
  exame = { id: v.id, codigo: e.codigo, slug: e.certificacao.slug, dominios: v.domains.map((d) => d.id) };
  await importarQuestoes(db, arquivoFicticio(exame.codigo, ["1", "2", "3", "4"], 12));
  const ids = await db.question.findMany({ where: { examVersionId: exame.id }, select: { id: true } });
  await moderarQuestoes(
    db,
    ids.map((q) => q.id),
    { aprovar: true },
  );
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: usuarios } } });
  await db.question.deleteMany({ where: { examVersionId: exame.id } });
  await db.examVersion.deleteMany({ where: { id: exame.id } });
  await db.certification.deleteMany({ where: { slug: exame.slug } });
  await db.$disconnect();
});

describe("prontidão", () => {
  it("começa em 0 com faixa aberta e plano pelo que mais pesa", async () => {
    const u = await criarUsuario();
    const p = await prontidaoDoExame(u, exame.id);
    expect(p).toMatchObject({ score: 0, lowerBound: 0, upperBound: 100, sampleSize: 0, suficiente: false });
    expect(p.historico).toEqual([]);
    expect(p.plano).toHaveLength(5);
    expect(p.plano.every((i) => i.motivo === "sem_respostas")).toBe(true);
  });

  it("encerrar simulado grava a foto do exame e dos domínios; só o dono a vê", async () => {
    const u = await criarUsuario();
    const outro = await criarUsuario();
    await treinar(u, exame.dominios[0]!, true);
    const fotos = await db.readinessScore.findMany({ where: { userId: u }, select: { domainId: true, score: true } });
    expect(fotos).toHaveLength(1 + exame.dominios.length);
    const p = await prontidaoDoExame(u, exame.id);
    expect(p.sampleSize).toBe(10);
    expect(p.dominios[0]!.score).toBeGreaterThan(p.dominios[1]!.score);
    expect(p.historico).toHaveLength(1);
    expect(p.historico[0]!.score).toBe(p.score);

    const dele = await prontidaoDoExame(outro, exame.id);
    expect(dele).toMatchObject({ score: 0, sampleSize: 0, historico: [] });
  });

  it("errar mais baixa a estimativa", async () => {
    const u = await criarUsuario();
    await treinar(u, exame.dominios[1]!, true);
    const antes = await prontidaoDoExame(u, exame.id);
    await treinar(u, exame.dominios[1]!, false);
    const depois = await prontidaoDoExame(u, exame.id);
    expect(depois.score).toBeLessThan(antes.score);
    expect(depois.historico.map((h) => h.score)).toEqual([depois.score, antes.score]);
  });

  it("o acerto nos simulados alimenta a distribuição do ciclo", async () => {
    const u = await criarUsuario();
    const [d1, d2] = exame.dominios as [string, string];
    const igual = await previaCiclo(u, exame.id, [d1, d2], 600);
    await treinar(u, d1, true);
    await treinar(u, d2, false);
    const depois = await previaCiclo(u, exame.id, [d1, d2], 600);
    // Quem erra mais ganha mais tempo (fator 2 contra 1).
    expect(depois[d2]! - igual[d2]!).toBeGreaterThan(0);
    expect(depois[d1]! + depois[d2]!).toBe(600);
  });
});
