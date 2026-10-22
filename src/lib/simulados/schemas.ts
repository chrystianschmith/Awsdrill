import { z } from "zod";
import { urlOficial } from "@/lib/catalogo/fontes";

/**
 * Formato de importação do banco de questões (JSON). Toda questão entra como pendente de
 * moderação; nada aqui é publicado sozinho. Questão real de prova (dump) é proibida.
 */

export const CHAVES = ["A", "B", "C", "D", "E", "F"] as const;

const Alternativa = z.object({
  key: z.enum(CHAVES),
  text: z.string().trim().min(1).max(600),
});

export const QuestaoImportada = z
  .object({
    /** "1" (domínio) ou "1.2" (task statement) do exam guide vigente. */
    dominio: z.string().regex(/^\d+(\.\d+)?$/, "Use o código do domínio (1) ou da tarefa (1.2)."),
    tipo: z.enum(["SINGLE", "MULTIPLE"]),
    enunciado: z.string().trim().min(20).max(2000),
    alternativas: z.array(Alternativa).min(4).max(6),
    corretas: z.array(z.enum(CHAVES)).min(1),
    explicacao: z.string().trim().min(20).max(3000),
    fontes: z
      .array(z.string().refine(urlOficial, "Fonte deve ser https de docs.aws.amazon.com ou aws.amazon.com."))
      .min(1, "Cite ao menos uma fonte oficial.")
      .max(5),
  })
  .superRefine((q, ctx) => {
    const chaves = q.alternativas.map((a) => a.key);
    if (new Set(chaves).size !== chaves.length)
      ctx.addIssue({ code: "custom", path: ["alternativas"], message: "Alternativas com chave repetida." });
    const esperadas = CHAVES.slice(0, chaves.length);
    if (chaves.some((c, i) => c !== esperadas[i]))
      ctx.addIssue({ code: "custom", path: ["alternativas"], message: "Chaves em sequência a partir de A." });
    const textos = q.alternativas.map((a) => a.text.toLowerCase());
    if (new Set(textos).size !== textos.length)
      ctx.addIssue({ code: "custom", path: ["alternativas"], message: "Alternativas com texto repetido." });
    if (new Set(q.corretas).size !== q.corretas.length)
      ctx.addIssue({ code: "custom", path: ["corretas"], message: "Resposta correta repetida." });
    if (q.corretas.some((c) => !chaves.includes(c)))
      ctx.addIssue({ code: "custom", path: ["corretas"], message: "Resposta correta fora das alternativas." });
    if (q.tipo === "SINGLE" && q.corretas.length !== 1)
      ctx.addIssue({
        code: "custom",
        path: ["corretas"],
        message: "Questão de uma resposta tem exatamente uma correta.",
      });
    if (q.tipo === "MULTIPLE" && (q.corretas.length < 2 || q.corretas.length >= chaves.length))
      ctx.addIssue({
        code: "custom",
        path: ["corretas"],
        message: "Questão de múltiplas respostas tem duas ou mais corretas, e não todas.",
      });
  });

export const ArquivoQuestoes = z.object({
  exame: z.string().regex(/^[A-Z]{2,6}-[A-Z0-9]{2,5}$/, "Código do exame no formato SAA-C03."),
  origem: z.enum(["autoral", "ia"]),
  versaoPrompt: z.string().max(40).nullable().default(null),
  questoes: z.array(QuestaoImportada).min(1).max(500),
});

export type QuestaoImportada = z.infer<typeof QuestaoImportada>;
export type ArquivoQuestoes = z.infer<typeof ArquivoQuestoes>;
export type Chave = (typeof CHAVES)[number];
export type Alternativa = z.infer<typeof Alternativa>;
export const Alternativas = z.array(Alternativa);
