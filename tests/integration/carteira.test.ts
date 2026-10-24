import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { outbox } from "@/lib/email/send";
import { aplicarExame } from "@/lib/catalogo/publicacao";
import type { ExameColetado } from "@/lib/catalogo/schemas";
import {
  adicionarCertificacao,
  editarCertificacao,
  enviarLembretesRecertificacao,
  excluirCertificacao,
  listarCarteira,
} from "@/lib/carteira/servico";
import { EXAMES_INICIAIS } from "../../prisma/catalogo/exames";

const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
const usuarios: string[] = [];
let certId: string;
let codigo: string;
let slug: string;

async function criarUsuario(recertificacao = true): Promise<string> {
  const u = await db.user.create({
    data: {
      name: "Carteira Teste",
      email: `cart-${randomUUID()}@exemplo.test`,
      passwordHash: "x",
      notificationPreference: { create: { recertificacao } },
    },
    select: { id: true },
  });
  usuarios.push(u.id);
  return u.id;
}

beforeAll(async () => {
  const e = structuredClone(EXAMES_INICIAIS[0]) as ExameColetado;
  e.codigo = codigo = `CRT-${sufixo}`;
  e.certificacao = { ...e.certificacao, slug: (slug = `carteira-${sufixo.toLowerCase()}`) };
  await aplicarExame(db, e);
  certId = (await db.certification.findUniqueOrThrow({ where: { slug }, select: { id: true } })).id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: usuarios } } });
  await db.examVersion.deleteMany({ where: { certification: { slug } } });
  await db.certification.deleteMany({ where: { slug } });
  await db.$disconnect();
});

const agora = new Date("2026-10-24T15:00:00Z");

describe("carteira", () => {
  it("aprovado vence em 3 anos; reprovado não tem validade", async () => {
    const u = await criarUsuario();
    await adicionarCertificacao(
      u,
      { certificationId: certId, result: "PASSED", examDate: "2026-03-10", examCode: codigo },
      agora,
    );
    await adicionarCertificacao(u, { certificationId: certId, result: "FAILED", examDate: "2025-12-01" }, agora);
    const itens = await listarCarteira(u, agora);
    expect(itens.map((i) => [i.result, i.expiresAt?.toISOString().slice(0, 10) ?? null, i.situacao])).toEqual([
      ["PASSED", "2029-03-10", "valida"],
      ["FAILED", null, "reprovado"],
    ]);
  });

  it("recusa data futura, código de outra certificação, nota fora da escala e link sem https", async () => {
    const u = await criarUsuario();
    const base = { certificationId: certId, result: "PASSED" as const, examDate: "2026-01-10" };
    await expect(adicionarCertificacao(u, { ...base, examDate: "2026-10-25" }, agora)).rejects.toThrow("futuro");
    await expect(adicionarCertificacao(u, { ...base, examCode: "XYZ-C99" }, agora)).rejects.toThrow("não é desta");
    await expect(adicionarCertificacao(u, { ...base, scaledScore: 1200 }, agora)).rejects.toThrow();
    await expect(adicionarCertificacao(u, { ...base, badgeUrl: "javascript:alert(1)" }, agora)).rejects.toThrow();
    await expect(adicionarCertificacao(u, { ...base, badgeUrl: "http://exemplo.com/b" }, agora)).rejects.toThrow();
    // Campos extras (mass assignment) são recusados.
    await expect(
      adicionarCertificacao(u, { ...base, userId: "outro" } as unknown as typeof base, agora),
    ).rejects.toThrow();
    expect(await db.userCertification.count({ where: { userId: u } })).toBe(0);
  });

  it("outro usuário não edita nem exclui o registro", async () => {
    const dono = await criarUsuario();
    const intruso = await criarUsuario();
    const { id } = await adicionarCertificacao(
      dono,
      { certificationId: certId, result: "PASSED", examDate: "2026-01-10" },
      agora,
    );
    await expect(
      editarCertificacao(intruso, id, { certificationId: certId, result: "FAILED", examDate: "2026-01-10" }, agora),
    ).rejects.toThrow("Registro não encontrado.");
    await expect(excluirCertificacao(intruso, id)).rejects.toThrow("Registro não encontrado.");
    expect((await listarCarteira(dono, agora))[0]?.result).toBe("PASSED");
    expect(await listarCarteira(intruso, agora)).toEqual([]);
  });
});

describe("lembretes de recertificação", () => {
  it("um e-mail por usuário com as certificações do dia, uma vez por estágio, respeitando a preferência", async () => {
    const u = await criarUsuario();
    const semAviso = await criarUsuario(false);
    // Vencem em 2026-12-01 e 2027-01-10 (38 e 78 dias): ambas no estágio de 90 dias.
    await adicionarCertificacao(u, { certificationId: certId, result: "PASSED", examDate: "2023-12-01" }, agora);
    await adicionarCertificacao(u, { certificationId: certId, result: "PASSED", examDate: "2024-01-10" }, agora);
    await adicionarCertificacao(semAviso, { certificationId: certId, result: "PASSED", examDate: "2023-12-01" }, agora);

    const emailDe = async (userId: string) =>
      (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } })).email;
    const [emailU, emailSem] = [await emailDe(u), await emailDe(semAviso)];
    const antes = outbox.length;
    await enviarLembretesRecertificacao(agora);
    const enviados = outbox.slice(antes);
    expect(enviados.filter((e) => e.to === emailU)).toHaveLength(1);
    expect(enviados.filter((e) => e.to === emailSem)).toHaveLength(0);

    // No dia seguinte nada se repete; perto do fim sai o próximo estágio.
    const depois = outbox.length;
    await enviarLembretesRecertificacao(new Date("2026-10-25T15:00:00Z"));
    expect(outbox.slice(depois).filter((e) => e.to === emailU)).toHaveLength(0);
    await enviarLembretesRecertificacao(new Date("2026-11-05T15:00:00Z"));
    expect(outbox.slice(depois).filter((e) => e.to === emailU)).toHaveLength(1);
    const estagios = await db.userCertification.findMany({
      where: { userId: u },
      orderBy: { examDate: "asc" },
      select: { reminderStage: true },
    });
    expect(estagios.map((e) => e.reminderStage)).toEqual([30, 90]);
  });
});
