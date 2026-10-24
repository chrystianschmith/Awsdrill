import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { aplicarExame } from "@/lib/catalogo/publicacao";
import type { ExameColetado } from "@/lib/catalogo/schemas";
import { cicloAtual, criarCiclo, previaCiclo, proximoDoCiclo } from "@/lib/estudo/servico-ciclo";
import { definirStatusTopico, deixarDeSeguir, seguirExame } from "@/lib/estudo/servico-exames";
import { registrarRevisao, revisoesVencidas } from "@/lib/estudo/servico-revisoes";
import { excluirSessao, iniciarSessao, lancarSessaoManual } from "@/lib/estudo/servico-sessoes";
import { EXAMES_INICIAIS } from "../../prisma/catalogo/exames";
import { assinaturaPro } from "./apoio/plano";

const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
const usuarios: string[] = [];
const slugs: string[] = [];

type Exame = { id: string; dominios: { id: string; tarefas: { id: string }[] }[] };

async function criarExame(letra: string): Promise<Exame> {
  const e = structuredClone(EXAMES_INICIAIS[0]) as ExameColetado;
  e.codigo = `CIC${letra}-${sufixo}`;
  e.certificacao = { ...e.certificacao, slug: `ciclo-${letra.toLowerCase()}-${sufixo.toLowerCase()}` };
  slugs.push(e.certificacao.slug);
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
  return { id: v.id, dominios: v.domains.map((d) => ({ id: d.id, tarefas: d.children })) };
}

async function criarUsuario(): Promise<string> {
  const u = await db.user.create({
    data: {
      name: "Ciclo Teste",
      email: `ciclo-${randomUUID()}@exemplo.test`,
      passwordHash: "x",
      subscription: assinaturaPro(),
    },
    select: { id: true },
  });
  usuarios.push(u.id);
  return u.id;
}

/** Lança `minutos` de estudo manual no domínio, num dia passado distinto a cada chamada. */
let diaManual = 0;
async function estudar(userId: string, examVersionId: string, domainId: string, minutos: number) {
  diaManual += 1;
  const inicio = new Date(Date.UTC(2026, 0, 1 + diaManual, 12));
  await lancarSessaoManual(userId, {
    examVersionId,
    domainId,
    topicId: null,
    inicio,
    fim: new Date(inicio.getTime() + minutos * 60_000),
  });
}

let exame: Exame;
let outro: Exame;

beforeAll(async () => {
  exame = await criarExame("A");
  outro = await criarExame("B");
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: usuarios } } });
  await db.examVersion.deleteMany({ where: { certification: { slug: { in: slugs } } } });
  await db.certification.deleteMany({ where: { slug: { in: slugs } } });
  await db.$disconnect();
});

describe("ciclo de estudos", () => {
  it("só em exame seguido e com domínios do próprio exame; distribui pelo peso do blueprint", async () => {
    const u = await criarUsuario();
    const doms = exame.dominios.map((d) => d.id);
    await expect(criarCiclo(u, exame.id, doms, 600)).rejects.toThrow("Siga o exame antes de estudar.");
    await seguirExame(u, exame.id);
    await expect(criarCiclo(u, exame.id, [outro.dominios[0]!.id], 600)).rejects.toThrow(
      "Algum domínio escolhido não está disponível.",
    );
    await expect(criarCiclo(u, exame.id, doms, 60)).rejects.toThrow("pelo menos 120 minutos");

    // Pesos do CLF-C02: 24, 30, 34, 12 → 600 min viram 144, 180, 204, 72.
    const previa = await previaCiclo(u, exame.id, doms, 600);
    expect(doms.map((d) => previa[d])).toEqual([144, 180, 204, 72]);
  });

  it("sessões contam no domínio; ao cumprir tudo fecha e abre o próximo; excluir recalcula", async () => {
    const u = await criarUsuario();
    await seguirExame(u, exame.id);
    const [d1, d2] = exame.dominios;
    await criarCiclo(u, exame.id, [d1!.id, d2!.id], 120); // 24:30 → 53 e 67 min

    let ciclo = await cicloAtual(u);
    expect(ciclo?.items.map((i) => i.targetMin)).toEqual([53, 67]);
    expect(proximoDoCiclo(ciclo)?.domainId).toBe(d2!.id);

    await estudar(u, exame.id, d2!.id, 70);
    ciclo = await cicloAtual(u);
    expect(ciclo?.items.map((i) => i.doneMin)).toEqual([0, 70]);
    expect(proximoDoCiclo(ciclo)?.domainId).toBe(d1!.id);

    // Estudo de outro domínio fora do ciclo não conta.
    await estudar(u, exame.id, exame.dominios[2]!.id, 30);
    expect((await cicloAtual(u))?.items.map((i) => i.doneMin)).toEqual([0, 70]);

    await estudar(u, exame.id, d1!.id, 20);
    const sessao = await db.studySession.findFirstOrThrow({
      where: { userId: u, domainId: d1!.id },
      select: { id: true },
    });
    await excluirSessao(u, sessao.id);
    expect((await cicloAtual(u))?.items.map((i) => i.doneMin)).toEqual([0, 70]);

    await estudar(u, exame.id, d1!.id, 60);
    ciclo = await cicloAtual(u);
    expect(ciclo).toMatchObject({ number: 2, totalMin: 120 });
    expect(ciclo?.items.map((i) => i.doneMin)).toEqual([0, 0]);
    expect(await db.studyCycle.count({ where: { userId: u, closedAt: { not: null } } })).toBe(1);
  });

  it("modo ciclo só no domínio do ciclo aberto; deixar de seguir encerra o ciclo", async () => {
    const u = await criarUsuario();
    await seguirExame(u, exame.id);
    const [d1, , , d4] = exame.dominios;
    await criarCiclo(u, exame.id, [d1!.id], 60);
    await expect(
      iniciarSessao(u, { examVersionId: exame.id, domainId: d4!.id, topicId: null, mode: "CICLO" }),
    ).rejects.toThrow("Este domínio não está no seu ciclo aberto.");

    // Outro usuário não usa o ciclo alheio.
    const intruso = await criarUsuario();
    await seguirExame(intruso, exame.id);
    await expect(
      iniciarSessao(intruso, { examVersionId: exame.id, domainId: d1!.id, topicId: null, mode: "CICLO" }),
    ).rejects.toThrow("Este domínio não está no seu ciclo aberto.");

    await deixarDeSeguir(u, exame.id);
    expect(await cicloAtual(u)).toBeNull();
  });
});

describe("revisão espaçada", () => {
  it("concluir agenda +1; boa avança, difícil volta e marca Revisar; só o dono registra", async () => {
    const u = await criarUsuario();
    const intruso = await criarUsuario();
    await seguirExame(u, exame.id);
    const t = exame.dominios[0]!.tarefas[0]!.id;

    await definirStatusTopico(u, t, "CONCLUIDO");
    await definirStatusTopico(u, t, "CONCLUIDO"); // não duplica
    let pendentes = await db.review.findMany({ where: { userId: u, doneAt: null } });
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0]!.step).toBe(0);
    expect(pendentes[0]!.dueAt.getTime()).toBeGreaterThan(Date.now());
    expect(await revisoesVencidas(u)).toHaveLength(0);

    // Vence hoje: aparece no "Hoje".
    await db.review.update({ where: { id: pendentes[0]!.id }, data: { dueAt: new Date(Date.now() - 60_000) } });
    const [vencida] = await revisoesVencidas(u);
    expect(vencida?.topic.id).toBe(t);

    await expect(registrarRevisao(intruso, vencida!.id, true)).rejects.toThrow("Revisão não encontrada.");
    await registrarRevisao(u, vencida!.id, true);
    await expect(registrarRevisao(u, vencida!.id, true)).rejects.toThrow("Revisão não encontrada.");
    pendentes = await db.review.findMany({ where: { userId: u, doneAt: null } });
    expect(pendentes.map((r) => r.step)).toEqual([1]);

    await registrarRevisao(u, pendentes[0]!.id, false);
    pendentes = await db.review.findMany({ where: { userId: u, doneAt: null } });
    expect(pendentes.map((r) => r.step)).toEqual([0]);
    const status = await db.userTopic.findUniqueOrThrow({ where: { userId_topicId: { userId: u, topicId: t } } });
    expect(status.status).toBe("REVISAR");
  });

  it("voltar para não iniciado cancela a pendente; deixar de seguir tira da lista", async () => {
    const u = await criarUsuario();
    await seguirExame(u, exame.id);
    const [t1, t2] = exame.dominios[1]!.tarefas;
    await definirStatusTopico(u, t1!.id, "CONCLUIDO");
    await definirStatusTopico(u, t2!.id, "CONCLUIDO");
    await definirStatusTopico(u, t1!.id, "NAO_INICIADO");
    expect(await db.review.count({ where: { userId: u, doneAt: null } })).toBe(1);

    await db.review.updateMany({ where: { userId: u }, data: { dueAt: new Date(Date.now() - 60_000) } });
    expect(await revisoesVencidas(u)).toHaveLength(1);
    await deixarDeSeguir(u, exame.id);
    expect(await revisoesVencidas(u)).toHaveLength(0);
  });
});
