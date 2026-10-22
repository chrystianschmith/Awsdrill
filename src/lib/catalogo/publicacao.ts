import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { estadoDePublicacao, hashBlueprint, proximaRevisao, statusDosDados } from "./regras";
import { ExameColetado } from "./schemas";

export type ResultadoAplicacao = {
  codigo: string;
  revisao: number | null; // nova revisão de pesos gravada, ou null se o blueprint não mudou
  dataStatus: "OFFICIAL" | "A_CONFIRMAR";
  publishState: "PUBLISHED" | "PENDING_REVIEW";
};

const data = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00.000Z`) : null);

/**
 * Grava um exame coletado de fonte oficial (seed e pipeline), de forma idempotente:
 * certificação e versão por chave natural, domínios e tarefas por código, e uma nova
 * revisão de pesos só quando o hash do blueprint muda. Recebe o cliente para poder
 * rodar fora do Next (seed, GitHub Actions) e nos testes.
 */
export async function aplicarExame(db: PrismaClient, entrada: unknown): Promise<ResultadoAplicacao> {
  const exame = ExameColetado.parse(entrada);
  const dataStatus = statusDosDados(exame);
  const publishState = estadoDePublicacao(exame);
  const hash = hashBlueprint(exame.dominios);
  const lidoEm = data(exame.lidoEm) as Date;

  return db.$transaction(async (tx) => {
    const c = exame.certificacao;
    const cert = await tx.certification.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.nome, level: c.nivel, trackOrder: c.ordemTrilha },
      update: { name: c.nome, level: c.nivel, trackOrder: c.ordemTrilha },
      select: { id: true },
    });

    const campos = {
      status: exame.status,
      questionCount: exame.totalQuestoes,
      scoredQuestions: exame.questoesPontuadas,
      durationMinutes: exame.duracaoMin,
      passingScore: exame.notaCorte,
      priceUsd: exame.precoUsd === null ? null : new Prisma.Decimal(exame.precoUsd),
      launchedAt: data(exame.lancadoEm),
      retiresAt: data(exame.aposentaEm),
      sourceUrl: exame.fonteGuia,
      infoUrl: exame.fontePagina,
      retrievedAt: lidoEm,
      dataStatus,
      publishState,
    };
    const versao = await tx.examVersion.upsert({
      where: { code: exame.codigo },
      create: { certificationId: cert.id, code: exame.codigo, ...campos },
      update: campos,
      select: { id: true },
    });

    // Domínios e tarefas: o código é a identidade; nomes e ordem são atualizados.
    const idPorCodigo = new Map<string, string>();
    let ordem = 0;
    for (const d of exame.dominios) {
      const dominio = await tx.domain.upsert({
        where: { examVersionId_code: { examVersionId: versao.id, code: d.codigo } },
        create: { examVersionId: versao.id, code: d.codigo, nameEn: d.nomeEn, namePt: d.nomePt, order: ordem },
        update: { parentId: null, nameEn: d.nomeEn, namePt: d.nomePt, order: ordem },
        select: { id: true },
      });
      ordem++;
      idPorCodigo.set(d.codigo, dominio.id);
      for (const t of d.tarefas) {
        await tx.domain.upsert({
          where: { examVersionId_code: { examVersionId: versao.id, code: t.codigo } },
          create: {
            examVersionId: versao.id,
            parentId: dominio.id,
            code: t.codigo,
            nameEn: t.nomeEn,
            namePt: t.nomePt,
            order: ordem,
          },
          update: { parentId: dominio.id, nameEn: t.nomeEn, namePt: t.nomePt, order: ordem },
        });
        ordem++;
      }
    }

    // Uma revisão vale para o blueprint inteiro: a mesma em todos os domínios da versão.
    const ultima = await tx.blueprintWeight.findFirst({
      where: { domain: { examVersionId: versao.id } },
      orderBy: { revision: "desc" },
      select: { revision: true, sourceHash: true },
    });
    const revisao = proximaRevisao(ultima, hash);
    if (revisao !== null) {
      await tx.blueprintWeight.createMany({
        data: exame.dominios.map((d) => ({
          domainId: idPorCodigo.get(d.codigo) as string,
          revision: revisao,
          weightPct: d.peso === null ? null : new Prisma.Decimal(d.peso),
          sourceUrl: exame.fonteGuia,
          sourceHash: hash,
          effectiveFrom: lidoEm,
          dataStatus: d.peso === null ? "A_CONFIRMAR" : "OFFICIAL",
        })),
      });
    }

    return { codigo: exame.codigo, revisao, dataStatus, publishState };
  });
}
