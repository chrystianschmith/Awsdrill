import { z } from "zod";
import { urlOficial } from "./fontes";

/** Formato de um exame coletado de fonte oficial (seed e pipeline). Campo desconhecido = null. */

const urlOficialSchema = z.string().refine(urlOficial, "Use uma URL https de docs.aws.amazon.com ou aws.amazon.com.");
const inteiroOuNulo = z.number().int().positive().nullable();

export const TarefaColetada = z.object({
  codigo: z.string().regex(/^\d+\.\d+$/, "Código de tarefa no formato 1.2."),
  nomeEn: z.string().trim().min(3).max(300),
  nomePt: z.string().trim().min(3).max(300).nullable(),
});

export const DominioColetado = z.object({
  codigo: z.string().regex(/^\d+$/, "Código de domínio no formato 1."),
  nomeEn: z.string().trim().min(3).max(200),
  nomePt: z.string().trim().min(3).max(200).nullable(),
  /** Percentual do conteúdo pontuado; null = a confirmar. */
  peso: z.number().min(0).max(100).nullable(),
  tarefas: z.array(TarefaColetada),
});

export const ExameColetado = z.object({
  certificacao: z.object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    nome: z.string().trim().min(3).max(120),
    nivel: z.enum(["FOUNDATIONAL", "ASSOCIATE", "PROFESSIONAL", "SPECIALTY"]),
    ordemTrilha: z.number().int().min(0),
  }),
  codigo: z.string().regex(/^[A-Z]{2,6}-[A-Z0-9]{2,5}$/, "Código do exame no formato SAA-C03."),
  status: z.enum(["BETA", "ACTIVE", "RETIRING", "RETIRED"]),
  totalQuestoes: inteiroOuNulo,
  questoesPontuadas: inteiroOuNulo,
  duracaoMin: inteiroOuNulo,
  notaCorte: z.number().int().min(100).max(1000).nullable(),
  precoUsd: z.number().positive().nullable(),
  lancadoEm: z.iso.date().nullable(),
  aposentaEm: z.iso.date().nullable(),
  fonteGuia: urlOficialSchema,
  fontePagina: urlOficialSchema.nullable(),
  lidoEm: z.iso.date(),
  dominios: z.array(DominioColetado).min(1),
});

export type ExameColetado = z.infer<typeof ExameColetado>;
export type DominioColetado = z.infer<typeof DominioColetado>;
