import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { calcularConfianca, decidir, type Decisao } from "./confianca";
import { diffExame, type DiffExame } from "./diff";
import { urlOficial } from "./fontes";
import { exameGravado } from "./gravado";
import { lerGuiaPrincipal, lerPaginaDominio, montarColetado, urlMarkdown, type PaginaDominio } from "./guia";
import { enfileirarRevisao } from "./moderacao";
import { aplicarExame } from "./publicacao";
import { camposAConfirmar, problemasDoBlueprint } from "./regras";
import type { ExameColetado } from "./schemas";

/**
 * Pipeline mensal do catálogo: para cada exame vigente, lê o exam guide oficial, compara com o
 * gravado e publica, deixa como está ou manda para a moderação. A busca é injetada: em produção
 * é o coletor com allowlist e proteção de SSRF (scripts/pipeline/coletor.ts); nos testes, fixtures.
 */

export type Buscar = (url: string) => Promise<string>;

export type Verificacao = {
  codigo: string;
  decisao: Decisao;
  confianca: number;
  diff: DiffExame;
  problemas: string[];
  exame: ExameColetado;
};

/** Coleta e compara um exame, sem gravar nada. */
export async function verificarExame(atual: ExameColetado, buscar: Buscar, hoje: string): Promise<Verificacao> {
  if (!urlOficial(atual.fonteGuia)) throw new Error(`Fonte fora da allowlist: ${atual.fonteGuia}`);
  const urlGuia = urlMarkdown(atual.fonteGuia);
  const guia = lerGuiaPrincipal(await buscar(urlGuia), urlGuia);

  const paginas = new Map<string, PaginaDominio>();
  const problemasBusca: string[] = [];
  for (const d of guia.dominios) {
    try {
      paginas.set(d.codigo, lerPaginaDominio(await buscar(d.url)));
    } catch (err) {
      problemasBusca.push(`Falha ao ler o domínio ${d.codigo}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const { exame, problemas: problemasLeitura } = montarColetado(atual, guia, paginas, hoje);
  const diff = diffExame(atual, exame);
  const problemasBlueprint = problemasDoBlueprint(exame.dominios);
  const problemas = [...problemasBusca, ...problemasLeitura, ...problemasBlueprint];
  const confianca = calcularConfianca({
    problemasLeitura: [...problemasBusca, ...problemasLeitura],
    problemasBlueprint,
    camposAConfirmar: camposAConfirmar(exame),
    diff,
  });
  return { codigo: atual.codigo, decisao: decidir(diff, confianca), confianca, diff, problemas, exame };
}

export type ErroExecucao = { codigo: string; mensagem: string };

export type ResumoExecucao = {
  runId: string | null;
  verificados: number;
  semMudanca: number;
  publicados: number;
  moderacao: number;
  erros: ErroExecucao[];
  verificacoes: Verificacao[];
};

/** Exames que a pipeline acompanha: todo exame não aposentado com guia em host oficial. */
export async function examesAcompanhados(db: PrismaClient): Promise<string[]> {
  const versoes = await db.examVersion.findMany({
    where: { status: { not: "RETIRED" } },
    orderBy: { code: "asc" },
    select: { code: true, sourceUrl: true },
  });
  return versoes.filter((v) => urlOficial(v.sourceUrl)).map((v) => v.code);
}

/**
 * Executa a pipeline sobre os exames gravados. Em `dryRun` só lê e compara: não cria execução,
 * não publica e não enfileira. Erro em um exame não para os outros.
 */
export async function executarPipeline(
  db: PrismaClient,
  opcoes: { buscar: Buscar; hoje: string; dryRun?: boolean; codigos?: string[] },
): Promise<ResumoExecucao> {
  const dryRun = opcoes.dryRun ?? false;
  const run = dryRun ? null : await db.catalogRun.create({ data: {}, select: { id: true } });
  const resumo: ResumoExecucao = {
    runId: run?.id ?? null,
    verificados: 0,
    semMudanca: 0,
    publicados: 0,
    moderacao: 0,
    erros: [],
    verificacoes: [],
  };

  const codigos = opcoes.codigos ?? (await examesAcompanhados(db));
  for (const codigo of codigos) {
    try {
      const atual = await exameGravado(db, codigo);
      if (!atual) throw new Error("Exame não está no catálogo.");
      const v = await verificarExame(atual, opcoes.buscar, opcoes.hoje);
      resumo.verificados++;
      resumo.verificacoes.push(v);
      if (v.decisao === "SEM_MUDANCA") {
        resumo.semMudanca++;
        // Problema de leitura sem mudança (ex.: frase do corte sumiu) não publica nada, mas fica registrado.
        for (const p of v.problemas) resumo.erros.push({ codigo, mensagem: p });
        if (!dryRun) await aplicarExame(db, v.exame); // só atualiza a data de leitura
      } else if (v.decisao === "PUBLICAR") {
        resumo.publicados++;
        if (!dryRun) await aplicarExame(db, v.exame);
      } else {
        resumo.moderacao++;
        if (!dryRun) {
          await enfileirarRevisao(db, {
            runId: run?.id ?? null,
            exame: v.exame,
            diff: v.diff,
            confianca: v.confianca,
            problemas: v.problemas,
          });
        }
      }
    } catch (err) {
      resumo.erros.push({ codigo, mensagem: (err instanceof Error ? err.message : String(err)).slice(0, 500) });
    }
  }

  if (run) {
    const falhouTudo = resumo.verificados === 0 && codigos.length > 0;
    await db.catalogRun.update({
      where: { id: run.id },
      data: {
        status: falhouTudo ? "FAILED" : resumo.erros.length > 0 ? "PARTIAL" : "SUCCEEDED",
        finishedAt: new Date(),
        examsChecked: resumo.verificados,
        examsUnchanged: resumo.semMudanca,
        examsPublished: resumo.publicados,
        examsModeration: resumo.moderacao,
        errors: resumo.erros as unknown as Prisma.InputJsonValue,
      },
    });
  }
  return resumo;
}
