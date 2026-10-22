import type { PrismaClient } from "@/generated/prisma/client";
import type { ExameColetado } from "./schemas";

const isoData = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * O exame como está gravado, no mesmo formato da coleta, para o diff da pipeline.
 * Pesos da última revisão; domínios e tarefas que saíram do guia ficam de fora.
 */
export async function exameGravado(db: PrismaClient, codigo: string): Promise<ExameColetado | null> {
  const v = await db.examVersion.findUnique({
    where: { code: codigo },
    select: {
      code: true,
      status: true,
      questionCount: true,
      scoredQuestions: true,
      durationMinutes: true,
      passingScore: true,
      priceUsd: true,
      launchedAt: true,
      retiresAt: true,
      sourceUrl: true,
      infoUrl: true,
      retrievedAt: true,
      certification: { select: { slug: true, name: true, level: true, trackOrder: true } },
      domains: {
        where: { parentId: null, retiredAt: null },
        orderBy: { order: "asc" },
        select: {
          code: true,
          nameEn: true,
          namePt: true,
          weights: { orderBy: { revision: "desc" }, take: 1, select: { weightPct: true } },
          children: {
            where: { retiredAt: null },
            orderBy: { order: "asc" },
            select: { code: true, nameEn: true, namePt: true },
          },
        },
      },
    },
  });
  if (!v) return null;
  const peso = v.domains.map((d) => d.weights[0]?.weightPct ?? null);
  return {
    certificacao: {
      slug: v.certification.slug,
      nome: v.certification.name,
      nivel: v.certification.level,
      ordemTrilha: v.certification.trackOrder,
    },
    codigo: v.code,
    status: v.status,
    totalQuestoes: v.questionCount,
    questoesPontuadas: v.scoredQuestions,
    duracaoMin: v.durationMinutes,
    notaCorte: v.passingScore,
    precoUsd: v.priceUsd === null ? null : v.priceUsd.toNumber(),
    lancadoEm: isoData(v.launchedAt),
    aposentaEm: isoData(v.retiresAt),
    fonteGuia: v.sourceUrl,
    fontePagina: v.infoUrl,
    lidoEm: isoData(v.retrievedAt) as string,
    dominios: v.domains.map((d, i) => ({
      codigo: d.code,
      nomeEn: d.nameEn,
      nomePt: d.namePt,
      peso: peso[i] === null ? null : peso[i]!.toNumber(),
      tarefas: d.children.map((t) => ({ codigo: t.code, nomeEn: t.nameEn, nomePt: t.namePt })),
    })),
  };
}
