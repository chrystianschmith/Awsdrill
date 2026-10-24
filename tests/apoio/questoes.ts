import type { ArquivoQuestoes, QuestaoImportada } from "@/lib/simulados/schemas";

/**
 * Questões fictícias para teste (não são conteúdo do produto): enunciado único por índice,
 * resposta correta "A" (ou "A" e "C" nas de múltipla escolha).
 */
export function questaoFicticia(dominio: string, i: number, tipo: "SINGLE" | "MULTIPLE" = "SINGLE"): QuestaoImportada {
  return {
    dominio,
    tipo,
    enunciado: `Questão fictícia de teste ${dominio}-${i}: qual alternativa está correta neste cenário?`,
    alternativas: [
      { key: "A", text: `Correta ${dominio}-${i}` },
      { key: "B", text: `Errada um ${dominio}-${i}` },
      { key: "C", text: tipo === "MULTIPLE" ? `Correta também ${dominio}-${i}` : `Errada dois ${dominio}-${i}` },
      { key: "D", text: `Errada três ${dominio}-${i}` },
      ...(tipo === "MULTIPLE" ? [{ key: "E" as const, text: `Errada quatro ${dominio}-${i}` }] : []),
    ],
    corretas: tipo === "MULTIPLE" ? ["A", "C"] : ["A"],
    explicacao: `Explicação fictícia da questão ${dominio}-${i}, só para testes.`,
    fontes: ["https://docs.aws.amazon.com/whitepapers/latest/aws-overview/introduction.html"],
  };
}

/** Arquivo com `porDominio` questões em cada código informado. */
export function arquivoFicticio(exame: string, codigos: string[], porDominio: number): ArquivoQuestoes {
  return {
    exame,
    origem: "autoral",
    versaoPrompt: null,
    questoes: codigos.flatMap((c) =>
      Array.from({ length: porDominio }, (_, i) => questaoFicticia(c, i, i % 5 === 4 ? "MULTIPLE" : "SINGLE")),
    ),
  };
}

/** Resposta válida da IA para o material de uma tarefa (fictícia, para os mocks). */
export function materialFicticio(tarefa: string, semente = "a") {
  return {
    resumo: {
      texto: [
        `### Resumo fictício ${tarefa}-${semente}`,
        "Parágrafo de teste com **negrito** e `código`, escrito só para validar o formato do material.",
        ...Array.from({ length: 8 }, (_, i) => `- Item de teste ${i + 1} do resumo fictício, com algumas palavras.`),
      ].join("\n"),
      fontes: ["https://docs.aws.amazon.com/whitepapers/latest/aws-overview/introduction.html"],
    },
    flashcards: Array.from({ length: 5 }, (_, i) => ({
      frente: `Pergunta fictícia ${i + 1} (${semente})`,
      verso: `Resposta ${i + 1}`,
    })),
    questoes: Array.from({ length: 5 }, (_, i) =>
      questaoFicticia(tarefa, i + 100 * semente.charCodeAt(0), i === 4 ? "MULTIPLE" : "SINGLE"),
    ),
  };
}
