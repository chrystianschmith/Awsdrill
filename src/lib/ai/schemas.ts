import { z } from "zod";
import { urlOficial } from "@/lib/catalogo/fontes";
import { QuestaoImportada } from "@/lib/simulados/schemas";

/*
 * Saída obrigatória da IA para o material de uma tarefa. Tudo que não passar aqui é
 * devolvido à IA como erro (gerar-validado.ts) e nunca chega ao banco nem à tela.
 */

const FonteOficial = z.string().refine(urlOficial, "Fonte deve ser https de docs.aws.amazon.com ou aws.amazon.com.");

export const ResumoIA = z.object({
  texto: z
    .string()
    .trim()
    .min(400, "O resumo deve ter ao menos cerca de 80 palavras.")
    .max(6000)
    .refine((t) => t.split(/\s+/).length <= 700, "O resumo deve ter no máximo cerca de 600 palavras."),
  fontes: z.array(FonteOficial).min(1, "Cite ao menos uma fonte oficial.").max(8),
});

export const FlashcardIA = z.object({
  frente: z.string().trim().min(3).max(300),
  verso: z.string().trim().min(1).max(600),
});

export const MaterialIA = z.object({
  resumo: ResumoIA,
  flashcards: z.array(FlashcardIA).min(5).max(10),
  questoes: z.array(QuestaoImportada).length(5),
});
export type MaterialIA = z.infer<typeof MaterialIA>;

/** Mensagem curta com os problemas de validação, usada na rodada de correção. */
export function resumirErroZod(error: z.ZodError): string {
  return error.issues
    .slice(0, 15)
    .map((i) => `- ${i.path.length ? i.path.join(".") : "(raiz)"}: ${i.message}`)
    .join("\n");
}
