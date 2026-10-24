import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { aplicarExame } from "@/lib/catalogo/publicacao";
import type { ExameColetado } from "@/lib/catalogo/schemas";
import { seguirExame } from "@/lib/estudo/servico-exames";
import { importarQuestoes, moderarQuestoes } from "@/lib/simulados/importacao";
import { enviarSimulado, iniciarSimulado, obterSimulado, relatorioSimulado, responder } from "@/lib/simulados/servico";
import { EXAMES_INICIAIS } from "../../prisma/catalogo/exames";
import { arquivoFicticio, questaoFicticia } from "../apoio/questoes";
import { assinaturaPro } from "./apoio/plano";

const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
const usuarios: string[] = [];
const slugs: string[] = [];
const codigos: string[] = [];

async function criarExame(letra: string): Promise<{ id: string; codigo: string; dominios: string[] }> {
  const e = structuredClone(EXAMES_INICIAIS[0]) as ExameColetado;
  e.codigo = `SIM${letra}-${sufixo}`;
  e.certificacao = { ...e.certificacao, slug: `sim-${letra.toLowerCase()}-${sufixo.toLowerCase()}` };
  slugs.push(e.certificacao.slug);
  codigos.push(e.codigo);
  await aplicarExame(db, e);
  const v = await db.examVersion.findUniqueOrThrow({
    where: { code: e.codigo },
    select: { id: true, domains: { where: { parentId: null }, orderBy: { order: "asc" }, select: { id: true } } },
  });
  return { id: v.id, codigo: e.codigo, dominios: v.domains.map((d) => d.id) };
}

async function criarUsuario(): Promise<string> {
  const u = await db.user.create({
    data: {
      name: "Simulado Teste",
      email: `sim-${randomUUID()}@exemplo.test`,
      passwordHash: "x",
      subscription: assinaturaPro(),
    },
    select: { id: true },
  });
  usuarios.push(u.id);
  return u.id;
}

async function publicarTudo(examVersionId: string) {
  const pendentes = await db.question.findMany({
    where: { examVersionId, publishState: "PENDING_REVIEW" },
    select: { id: true },
  });
  await moderarQuestoes(
    db,
    pendentes.map((p) => p.id),
    { aprovar: true },
  );
}

/** Responde certo (true) ou errado (false) usando o gabarito do banco. */
async function chaves(questionId: string, certo: boolean) {
  const q = await db.question.findUniqueOrThrow({ where: { id: questionId }, select: { correctKeys: true } });
  if (certo) return q.correctKeys;
  return q.correctKeys.length === 1 ? ["B"] : ["B", "D"];
}

let exame: Awaited<ReturnType<typeof criarExame>>;
let vazio: Awaited<ReturnType<typeof criarExame>>;

beforeAll(async () => {
  exame = await criarExame("A");
  vazio = await criarExame("B");
  // 12 questões em cada domínio (via tarefa 1.1, 2.1… e via domínio "4").
  await importarQuestoes(db, arquivoFicticio(exame.codigo, ["1.1", "2.1", "3.1", "4"], 12));
  await publicarTudo(exame.id);
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: usuarios } } });
  await db.question.deleteMany({ where: { examVersion: { code: { in: codigos } } } });
  await db.examVersion.deleteMany({ where: { certification: { slug: { in: slugs } } } });
  await db.certification.deleteMany({ where: { slug: { in: slugs } } });
  await db.$disconnect();
});

describe("importação e moderação", () => {
  it("liga tarefa ao domínio pai, ignora repetidas, recusa código inexistente e só publica o aprovado", async () => {
    const r = await importarQuestoes(db, {
      exame: vazio.codigo,
      origem: "autoral",
      versaoPrompt: null,
      questoes: [
        questaoFicticia("1.2", 1),
        questaoFicticia("1.2", 1),
        questaoFicticia("9.9", 2),
        questaoFicticia("2", 3),
      ],
    });
    expect(r).toMatchObject({ criadas: 2, duplicadas: 1 });
    expect(r.erros).toEqual([{ indice: 2, motivo: expect.stringContaining("9.9") }]);
    const de12 = await db.question.findFirstOrThrow({
      where: { examVersionId: vazio.id, topicId: { not: null } },
      select: { id: true, domainId: true, topic: { select: { code: true, parentId: true } } },
    });
    expect(de12.topic).toMatchObject({ code: "1.2", parentId: de12.domainId });

    const u = await criarUsuario();
    await seguirExame(u, vazio.id);
    await expect(iniciarSimulado(u, { examVersionId: vazio.id, mode: "TREINO", quantidade: 10 })).rejects.toThrow(
      "Ainda não há questões publicadas",
    );
    await moderarQuestoes(db, [de12.id], { aprovar: true });
    const s = await iniciarSimulado(u, { examVersionId: vazio.id, mode: "TREINO", quantidade: 10 });
    expect((await obterSimulado(u, s.id)).questoes.map((q) => q.id)).toEqual([de12.id]);

    // Reimportar o mesmo arquivo não duplica.
    const deNovo = await importarQuestoes(db, arquivoFicticio(exame.codigo, ["1.1"], 12));
    expect(deNovo).toMatchObject({ criadas: 0, duplicadas: 12 });
  });
});

describe("modo treino", () => {
  it("só exame seguido; sorteio pelo filtro; gabarito só depois da resposta; uma resposta por questão", async () => {
    const u = await criarUsuario();
    await expect(iniciarSimulado(u, { examVersionId: exame.id, mode: "TREINO", quantidade: 10 })).rejects.toThrow(
      "Siga o exame antes de estudar.",
    );
    await seguirExame(u, exame.id);
    const s = await iniciarSimulado(u, {
      examVersionId: exame.id,
      mode: "TREINO",
      quantidade: 10,
      domainIds: [exame.dominios[3]!],
    });
    const dto = await obterSimulado(u, s.id);
    expect(dto.questoes).toHaveLength(10);
    expect(dto.questoes.every((q) => q.dominio.startsWith("4."))).toBe(true);
    expect(dto.questoes.every((q) => q.feedback === null)).toBe(true);
    expect(JSON.stringify(dto)).not.toContain("correctKeys");

    // Prefere uma de múltipla escolha; se o sorteio não trouxe nenhuma, testa com a de uma resposta.
    const q = dto.questoes.find((x) => x.quantasCorretas === 2) ?? dto.questoes[0]!;
    if (q.quantasCorretas === 2) {
      await expect(responder(u, s.id, q.id, ["A"])).rejects.toThrow("Escolha 2 alternativas.");
    } else {
      await expect(responder(u, s.id, q.id, ["A", "B"])).rejects.toThrow("Escolha uma alternativa.");
    }
    const certas = await chaves(q.id, true);
    const fb = await responder(u, s.id, q.id, [...certas].reverse());
    expect(fb).toMatchObject({ isCorrect: true, correctKeys: certas });
    await expect(responder(u, s.id, q.id, certas)).rejects.toThrow("Questão já respondida.");

    const depois = await obterSimulado(u, s.id);
    expect(depois.questoes.find((x) => x.id === q.id)?.feedback?.isCorrect).toBe(true);
    expect(depois.questoes.filter((x) => x.feedback !== null)).toHaveLength(1);
  });

  it("outro usuário não lê, não responde e não envia; questão fora do sorteio é recusada", async () => {
    const u = await criarUsuario();
    const intruso = await criarUsuario();
    await seguirExame(u, exame.id);
    await seguirExame(intruso, exame.id);
    const s = await iniciarSimulado(u, { examVersionId: exame.id, mode: "TREINO", quantidade: 10 });
    const q = (await obterSimulado(u, s.id)).questoes[0]!;
    await expect(obterSimulado(intruso, s.id)).rejects.toThrow("Simulado não encontrado.");
    await expect(responder(intruso, s.id, q.id, ["A"])).rejects.toThrow("Simulado não encontrado.");
    await expect(enviarSimulado(intruso, s.id)).rejects.toThrow("Simulado não encontrado.");
    await expect(relatorioSimulado(intruso, s.id)).rejects.toThrow("Simulado não encontrado.");

    const fora = await db.question.findFirstOrThrow({
      where: { examVersionId: exame.id, id: { notIn: (await obterSimulado(u, s.id)).questoes.map((x) => x.id) } },
      select: { id: true },
    });
    await expect(responder(u, s.id, fora.id, ["A"])).rejects.toThrow("Questão não encontrada.");
  });

  it("começar outro simulado encerra o anterior com o que foi respondido", async () => {
    const u = await criarUsuario();
    await seguirExame(u, exame.id);
    const a = await iniciarSimulado(u, { examVersionId: exame.id, mode: "TREINO", quantidade: 10 });
    const q = (await obterSimulado(u, a.id)).questoes[0]!;
    await responder(u, a.id, q.id, await chaves(q.id, true));
    await iniciarSimulado(u, { examVersionId: exame.id, mode: "TREINO", quantidade: 20 });
    expect(await relatorioSimulado(u, a.id)).toMatchObject({ status: "SUBMITTED", corretas: 1, total: 10 });
  });
});

describe("modo prova", () => {
  it("tamanho e prazo oficiais (limitado ao banco), sem feedback, troca até enviar, relatório por domínio", async () => {
    const u = await criarUsuario();
    await seguirExame(u, exame.id);
    const s = await iniciarSimulado(u, { examVersionId: exame.id, mode: "PROVA" });
    const dto = await obterSimulado(u, s.id);
    expect(dto.questoes).toHaveLength(48); // 65 pedidas, 48 no banco
    const prazo = new Date(dto.deadlineAt!).getTime() - new Date(dto.serverNow).getTime();
    expect(prazo).toBeGreaterThan(89 * 60_000);
    expect(prazo).toBeLessThanOrEqual(90 * 60_000);

    const [q1, q2, q3] = dto.questoes;
    expect(await responder(u, s.id, q1!.id, await chaves(q1!.id, false))).toBeNull();
    await responder(u, s.id, q1!.id, await chaves(q1!.id, true)); // trocou para a certa
    await responder(u, s.id, q2!.id, await chaves(q2!.id, true));
    await responder(u, s.id, q3!.id, await chaves(q3!.id, false));
    expect((await obterSimulado(u, s.id)).questoes.every((q) => q.feedback === null)).toBe(true);

    await enviarSimulado(u, s.id);
    const rel = await relatorioSimulado(u, s.id);
    expect(rel).toMatchObject({ status: "SUBMITTED", corretas: 2, total: 48, pct: 4 });
    expect(rel!.dominios.map((d) => d.codigo)).toEqual(["1", "2", "3", "4"]);
    expect(rel!.dominios.reduce((s, d) => s + d.total, 0)).toBe(48);
    await expect(responder(u, s.id, q3!.id, await chaves(q3!.id, true))).rejects.toThrow(
      "Este simulado já foi encerrado.",
    );
    expect((await obterSimulado(u, s.id)).questoes[0]!.feedback).not.toBeNull();
  });

  it("prazo expirado recusa resposta e encerra a prova como expirada", async () => {
    const u = await criarUsuario();
    await seguirExame(u, exame.id);
    const s = await iniciarSimulado(u, { examVersionId: exame.id, mode: "PROVA" });
    const q = (await obterSimulado(u, s.id)).questoes[0]!;
    await responder(u, s.id, q.id, await chaves(q.id, true));
    await db.mockAttempt.update({ where: { id: s.id }, data: { deadlineAt: new Date(Date.now() - 10_000) } });

    const outra = (await obterSimulado(u, s.id)).questoes[1]!;
    await expect(responder(u, s.id, outra.id, ["A"])).rejects.toThrow("O tempo da prova acabou.");
    expect(await relatorioSimulado(u, s.id)).toMatchObject({ status: "EXPIRED", corretas: 1 });
  });
});
