import type { Prisma } from "@/generated/prisma/client";
import type { Executor } from "@/lib/estudo/acao";
import { hashQuestao } from "./regras";
import type { ArquivoQuestoes } from "./schemas";

/*
 * Importação do banco de questões (scripts/questoes/importar.ts). Roda fora do app, com o
 * arquivo já validado por ArquivoQuestoes. Tudo entra PENDING_REVIEW; só a moderação publica.
 */

export type ResultadoImportacao = {
  criadas: number;
  duplicadas: number;
  erros: { indice: number; motivo: string }[];
};

export async function importarQuestoes(db: Executor, arquivo: ArquivoQuestoes): Promise<ResultadoImportacao> {
  const versao = await db.examVersion.findUnique({
    where: { code: arquivo.exame },
    select: {
      id: true,
      domains: { where: { retiredAt: null }, select: { id: true, code: true, parentId: true } },
    },
  });
  if (!versao)
    return { criadas: 0, duplicadas: 0, erros: [{ indice: -1, motivo: `Exame ${arquivo.exame} não existe.` }] };
  const porCodigo = new Map(versao.domains.map((d) => [d.code, d]));

  const erros: ResultadoImportacao["erros"] = [];
  const linhas: Prisma.QuestionCreateManyInput[] = [];
  const hashes = new Set<string>();
  arquivo.questoes.forEach((q, indice) => {
    const alvo = porCodigo.get(q.dominio);
    if (!alvo) {
      erros.push({ indice, motivo: `Domínio ou tarefa ${q.dominio} não existe no exam guide vigente.` });
      return;
    }
    const contentHash = hashQuestao(q.enunciado, q.alternativas);
    if (hashes.has(contentHash)) return; // repetida dentro do próprio arquivo
    hashes.add(contentHash);
    linhas.push({
      examVersionId: versao.id,
      domainId: alvo.parentId ?? alvo.id,
      topicId: alvo.parentId ? alvo.id : null,
      type: q.tipo,
      stem: q.enunciado,
      options: q.alternativas,
      correctKeys: q.corretas,
      explanation: q.explicacao,
      docUrls: q.fontes,
      origin: arquivo.origem,
      promptVersion: arquivo.versaoPrompt,
      contentHash,
    });
  });
  const r = await db.question.createMany({ data: linhas, skipDuplicates: true });
  return { criadas: r.count, duplicadas: arquivo.questoes.length - erros.length - r.count, erros };
}

/** Moderação: aprovar publica; rejeitar guarda o motivo. Só questões pendentes. */
export async function moderarQuestoes(
  db: Executor,
  ids: string[],
  decisao: { aprovar: true } | { aprovar: false; nota: string },
): Promise<number> {
  const r = await db.question.updateMany({
    where: { id: { in: ids }, publishState: "PENDING_REVIEW" },
    data: decisao.aprovar
      ? { publishState: "PUBLISHED", reviewedAt: new Date() }
      : { publishState: "REJECTED", reviewedAt: new Date(), reviewNote: decisao.nota },
  });
  return r.count;
}
