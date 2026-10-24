import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { UpgradeRequiredError } from "@/lib/assinaturas/entitlements";
import { aplicarPlanoEfetivoCom } from "@/lib/assinaturas/plano-efetivo";
import { repoPrisma } from "@/lib/assinaturas/repo-prisma";
import { aplicarExame } from "@/lib/catalogo/publicacao";
import type { ExameColetado } from "@/lib/catalogo/schemas";
import { gerarMaterial, reportarErro } from "@/lib/ai/servico-material";
import { examesParaSeguir, examesSeguidos } from "@/lib/estudo/consultas";
import { criarCiclo } from "@/lib/estudo/servico-ciclo";
import { definirStatusTopico, seguirExame } from "@/lib/estudo/servico-exames";
import { importarQuestoes, moderarQuestoes } from "@/lib/simulados/importacao";
import { iniciarSimulado } from "@/lib/simulados/servico";
import { EXAMES_INICIAIS } from "../../prisma/catalogo/exames";
import { arquivoFicticio } from "../apoio/questoes";
import { assinaturaPro } from "./apoio/plano";

/*
 * Limites do Grátis checados no servidor (o que a UI esconde também é recusado aqui)
 * e downgrade sem perda: o exame extra fica pausado e volta ao reativar o Pro.
 */

const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
const usuarios: string[] = [];
const slugs: string[] = [];
const codigos: string[] = [];

type Exame = { id: string; codigo: string; dominios: string[]; tarefa: string };

async function criarExame(letra: string): Promise<Exame> {
  const e = structuredClone(EXAMES_INICIAIS[0]) as ExameColetado;
  e.codigo = `PLN${letra}-${sufixo}`;
  e.certificacao = { ...e.certificacao, slug: `plano-${letra.toLowerCase()}-${sufixo.toLowerCase()}` };
  slugs.push(e.certificacao.slug);
  codigos.push(e.codigo);
  await aplicarExame(db, e);
  const v = await db.examVersion.findUniqueOrThrow({
    where: { code: e.codigo },
    select: {
      id: true,
      domains: {
        where: { parentId: null },
        orderBy: { order: "asc" },
        select: { id: true, children: { orderBy: { order: "asc" }, select: { id: true } } },
      },
    },
  });
  return {
    id: v.id,
    codigo: e.codigo,
    dominios: v.domains.map((d) => d.id),
    tarefa: v.domains[0]!.children[0]!.id,
  };
}

async function criarUsuario(pro = false): Promise<string> {
  const u = await db.user.create({
    data: {
      name: "Plano Teste",
      email: `plano-${randomUUID()}@exemplo.test`,
      passwordHash: "x",
      ...(pro ? { subscription: assinaturaPro() } : {}),
    },
    select: { id: true },
  });
  usuarios.push(u.id);
  return u.id;
}

let a: Exame;
let b: Exame;

beforeAll(async () => {
  a = await criarExame("A");
  b = await criarExame("B");
  await importarQuestoes(db, arquivoFicticio(a.codigo, ["1.1", "2.1", "3.1", "4"], 12));
  const pendentes = await db.question.findMany({ where: { examVersionId: a.id }, select: { id: true } });
  await moderarQuestoes(
    db,
    pendentes.map((p) => p.id),
    { aprovar: true },
  );
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: usuarios } } });
  await db.question.deleteMany({ where: { examVersion: { code: { in: codigos } } } });
  await db.examVersion.deleteMany({ where: { certification: { slug: { in: slugs } } } });
  await db.certification.deleteMany({ where: { slug: { in: slugs } } });
  await db.$disconnect();
});

describe("limites do Grátis", () => {
  it("segue um exame por vez, mesmo com dois pedidos simultâneos", async () => {
    const u = await criarUsuario();
    const r = await Promise.allSettled([seguirExame(u, a.id), seguirExame(u, b.id)]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const recusa = r.find((x) => x.status === "rejected");
    expect(recusa?.status === "rejected" && recusa.reason).toBeInstanceOf(UpgradeRequiredError);
    expect(await db.userExam.count({ where: { userId: u, status: "ATIVO" } })).toBe(1);
    // Seguir de novo o mesmo exame é idempotente, não conta como segundo.
    const seguido = (await examesSeguidos(u))[0]!.examVersionId;
    await expect(seguirExame(u, seguido)).resolves.toBeUndefined();
  });

  it("modo prova, ciclo, material e reportar erro são recusados", async () => {
    const u = await criarUsuario();
    await seguirExame(u, a.id);
    await expect(iniciarSimulado(u, { examVersionId: a.id, mode: "PROVA" })).rejects.toBeInstanceOf(
      UpgradeRequiredError,
    );
    await expect(criarCiclo(u, a.id, a.dominios, 600)).rejects.toBeInstanceOf(UpgradeRequiredError);
    await expect(gerarMaterial(u, a.tarefa)).rejects.toBeInstanceOf(UpgradeRequiredError);
    await expect(
      reportarErro(u, { topicId: a.tarefa, contentType: "summary", contentId: "x", message: "Fonte errada aqui." }),
    ).rejects.toBeInstanceOf(UpgradeRequiredError);
  });

  it("treino tem limite semanal; o Pro não", async () => {
    const u = await criarUsuario();
    await seguirExame(u, a.id);
    for (let i = 0; i < 5; i++) await iniciarSimulado(u, { examVersionId: a.id, mode: "TREINO", quantidade: 10 });
    await expect(iniciarSimulado(u, { examVersionId: a.id, mode: "TREINO", quantidade: 10 })).rejects.toThrow(
      "5 simulados de treino por semana",
    );
    // A recusa não encerrou o treino em andamento (a transação voltou atrás).
    expect(await db.mockAttempt.count({ where: { userId: u, status: "IN_PROGRESS" } })).toBe(1);

    const p = await criarUsuario(true);
    await seguirExame(p, a.id);
    for (let i = 0; i < 6; i++) await iniciarSimulado(p, { examVersionId: a.id, mode: "TREINO", quantidade: 10 });
  });

  it("concluir tarefa no Grátis não agenda revisão; no Pro agenda", async () => {
    const u = await criarUsuario();
    await seguirExame(u, a.id);
    await definirStatusTopico(u, a.tarefa, "CONCLUIDO");
    expect(await db.review.count({ where: { userId: u } })).toBe(0);

    const p = await criarUsuario(true);
    await seguirExame(p, a.id);
    await definirStatusTopico(p, a.tarefa, "CONCLUIDO");
    expect(await db.review.count({ where: { userId: p } })).toBe(1);
  });
});

describe("downgrade sem perda", () => {
  it("ao cair para o Grátis pausa o exame mais novo; ao voltar ao Pro, reativa", async () => {
    const u = await criarUsuario(true);
    await seguirExame(u, a.id);
    await seguirExame(u, b.id);
    await definirStatusTopico(u, b.tarefa, "ESTUDANDO");

    await db.subscription.update({ where: { userId: u }, data: { status: "canceled" } });
    const agora = new Date();
    expect(await repoPrisma.transacao((tx) => aplicarPlanoEfetivoCom(tx, u, agora))).toEqual({
      de: "PRO",
      para: "FREE",
    });
    expect((await examesSeguidos(u)).map((e) => e.codigo)).toEqual([a.codigo]);
    expect((await examesParaSeguir(u)).find((e) => e.id === b.id)?.pausado).toBe(true);
    // O progresso do exame pausado continua guardado.
    expect(await db.userTopic.count({ where: { userId: u, topicId: b.tarefa } })).toBe(1);
    // Retomar o pausado no Grátis esbarra no limite.
    await expect(seguirExame(u, b.id)).rejects.toBeInstanceOf(UpgradeRequiredError);

    await db.subscription.update({ where: { userId: u }, data: { status: "active" } });
    await repoPrisma.transacao((tx) => aplicarPlanoEfetivoCom(tx, u, agora));
    expect((await examesSeguidos(u)).map((e) => e.codigo).sort()).toEqual([a.codigo, b.codigo].sort());
  });
});
