import "server-only";
import { db } from "@/lib/db";
import { ordenarTrilha, type Nivel, type StatusExame } from "./regras";

/** Leituras públicas do catálogo: só versões publicadas, em DTOs sem Decimal. */

export type ExameResumo = {
  codigo: string;
  status: StatusExame;
  totalQuestoes: number | null;
  duracaoMin: number | null;
  notaCorte: number | null;
  precoUsd: number | null;
  aConfirmar: boolean;
};

export type CertificacaoResumo = { slug: string; nome: string; nivel: Nivel; ordem: number; exame: ExameResumo };

const STATUS_VISIVEIS: StatusExame[] = ["BETA", "ACTIVE", "RETIRING"];

function resumo(v: {
  code: string;
  status: StatusExame;
  questionCount: number | null;
  durationMinutes: number | null;
  passingScore: number | null;
  priceUsd: { toNumber(): number } | null;
  dataStatus: "OFFICIAL" | "A_CONFIRMAR";
}): ExameResumo {
  return {
    codigo: v.code,
    status: v.status,
    totalQuestoes: v.questionCount,
    duracaoMin: v.durationMinutes,
    notaCorte: v.passingScore,
    precoUsd: v.priceUsd?.toNumber() ?? null,
    aConfirmar: v.dataStatus === "A_CONFIRMAR",
  };
}

const selectVersao = {
  code: true,
  status: true,
  questionCount: true,
  durationMinutes: true,
  passingScore: true,
  priceUsd: true,
  dataStatus: true,
} as const;

/** Certificações com versão publicada e não aposentada, na ordem da trilha (uma versão por certificação, a mais nova). */
export async function listarCertificacoes(): Promise<CertificacaoResumo[]> {
  const certs = await db.certification.findMany({
    where: { versions: { some: { publishState: "PUBLISHED", status: { in: STATUS_VISIVEIS } } } },
    select: {
      slug: true,
      name: true,
      level: true,
      trackOrder: true,
      versions: {
        where: { publishState: "PUBLISHED", status: { in: STATUS_VISIVEIS } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: selectVersao,
      },
    },
  });
  return ordenarTrilha(certs).flatMap((c) => {
    const v = c.versions[0];
    return v ? [{ slug: c.slug, nome: c.name, nivel: c.level, ordem: c.trackOrder, exame: resumo(v) }] : [];
  });
}

export type DominioDetalhe = {
  codigo: string;
  nomeEn: string;
  nomePt: string | null;
  peso: number | null;
  tarefas: { codigo: string; nomeEn: string; nomePt: string | null }[];
};

export type CertificacaoDetalhe = CertificacaoResumo & {
  questoesPontuadas: number | null;
  validadeMeses: number;
  aposentaEm: Date | null;
  fonteGuia: string;
  fontePagina: string | null;
  lidoEm: Date;
  revisao: number | null;
  dominios: DominioDetalhe[];
};

/** Detalhe público de uma certificação: versão publicada mais nova, domínios, tarefas e pesos da última revisão. */
export async function certificacaoPorSlug(slug: string): Promise<CertificacaoDetalhe | null> {
  const cert = await db.certification.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      level: true,
      trackOrder: true,
      versions: {
        where: { publishState: "PUBLISHED", status: { in: STATUS_VISIVEIS } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          ...selectVersao,
          scoredQuestions: true,
          validityMonths: true,
          retiresAt: true,
          sourceUrl: true,
          infoUrl: true,
          retrievedAt: true,
          domains: {
            where: { parentId: null },
            orderBy: { order: "asc" },
            select: {
              code: true,
              nameEn: true,
              namePt: true,
              weights: { orderBy: { revision: "desc" }, take: 1, select: { revision: true, weightPct: true } },
              children: { orderBy: { order: "asc" }, select: { code: true, nameEn: true, namePt: true } },
            },
          },
        },
      },
    },
  });
  const v = cert?.versions[0];
  if (!cert || !v) return null;
  return {
    slug: cert.slug,
    nome: cert.name,
    nivel: cert.level,
    ordem: cert.trackOrder,
    exame: resumo(v),
    questoesPontuadas: v.scoredQuestions,
    validadeMeses: v.validityMonths,
    aposentaEm: v.retiresAt,
    fonteGuia: v.sourceUrl,
    fontePagina: v.infoUrl,
    lidoEm: v.retrievedAt,
    revisao: v.domains[0]?.weights[0]?.revision ?? null,
    dominios: v.domains.map((d) => ({
      codigo: d.code,
      nomeEn: d.nameEn,
      nomePt: d.namePt,
      peso: d.weights[0]?.weightPct?.toNumber() ?? null,
      tarefas: d.children.map((t) => ({ codigo: t.code, nomeEn: t.nameEn, nomePt: t.namePt })),
    })),
  };
}
