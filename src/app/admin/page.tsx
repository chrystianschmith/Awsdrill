import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { calcularChurn, calcularMrr } from "@/lib/admin/metricas";
import { configIA } from "@/lib/ai/config";
import { mesCorrente } from "@/lib/ai/orcamento";
import { intervaloDoPrice } from "@/lib/assinaturas/stripe";
import { formatBRL } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { fmtDataHora, fmtPct, fmtUsd } from "./_lib/formato";
import { Cabecalho, Indicador, StatusBadge, Tabela, td, th } from "./_components/ui";

export const metadata = { title: "Visão geral · Admin" };

export default async function AdminInicio() {
  await requireAdmin();
  const agora = new Date();
  const { inicio: inicioMes } = mesCorrente(agora);
  const trintaDias = new Date(agora.getTime() - 30 * 24 * 60 * 60_000);

  const [usuarios, novos, assinaturas, canceladas, maisSeguidos, questoes, reports, catalogo, gasto, ultimaExecucao] =
    await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.user.count({ where: { deletedAt: null, createdAt: { gte: trintaDias } } }),
      db.subscription.findMany({ select: { status: true, priceId: true, graceUntil: true, accessUntil: true } }),
      db.subscription.count({ where: { status: "canceled", updatedAt: { gte: inicioMes } } }),
      db.userExam.groupBy({
        by: ["examVersionId"],
        where: { status: "ATIVO" },
        _count: { _all: true },
        orderBy: { _count: { examVersionId: "desc" } },
        take: 5,
      }),
      db.question.count({ where: { publishState: "PENDING_REVIEW" } }),
      db.contentReport.count({ where: { resolvedAt: null } }),
      db.catalogReview.count({ where: { status: "PENDING" } }),
      db.aiUsageLog.aggregate({ where: { createdAt: { gte: inicioMes } }, _sum: { costUsd: true } }),
      db.catalogRun.findFirst({
        orderBy: { startedAt: "desc" },
        select: { status: true, startedAt: true, examsPublished: true, examsModeration: true },
      }),
    ]);

  const { mrrCents, pagantes, emTeste, semPreco } = calcularMrr(assinaturas, intervaloDoPrice, agora);
  const churn = calcularChurn(canceladas, pagantes);
  const exames = await db.examVersion.findMany({
    where: { id: { in: maisSeguidos.map((m) => m.examVersionId) } },
    select: { id: true, code: true },
  });
  const codigo = new Map(exames.map((e) => [e.id, e.code]));
  const gastoUsd = Number(gasto._sum.costUsd ?? 0);

  return (
    <>
      <Cabecalho titulo="Visão geral" descricao="Usuários, receita, filas de moderação e custo de IA." />

      <section aria-labelledby="negocio" className="grid gap-3">
        <h2 id="negocio" className="text-sm font-semibold">
          Negócio
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador
            rotulo="Usuários"
            valor={usuarios.toLocaleString("pt-BR")}
            detalhe={`${novos} nos últimos 30 dias`}
          />
          <Indicador
            rotulo="Assinantes pagantes"
            valor={pagantes.toLocaleString("pt-BR")}
            detalhe={`${emTeste} em teste grátis (fora da conta)`}
          />
          <Indicador
            rotulo="MRR estimado"
            valor={formatBRL(mrrCents)}
            detalhe={
              semPreco > 0
                ? `${semPreco} assinatura(s) com preço desconhecido ficaram de fora`
                : "Anual e Pix divididos por 12"
            }
          />
          <Indicador
            rotulo="Churn do mês"
            valor={fmtPct(churn)}
            detalhe={`${canceladas} cancelamento(s) desde o dia 1`}
          />
        </div>
      </section>

      <section aria-labelledby="conteudo" className="grid gap-3">
        <h2 id="conteudo" className="text-sm font-semibold">
          Conteúdo e catálogo
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador
            rotulo="Questões pendentes"
            valor={
              <Link href="/admin/questoes" className="hover:underline">
                {questoes}
              </Link>
            }
            detalhe="Aguardando aprovação"
          />
          <Indicador
            rotulo="Reports abertos"
            valor={
              <Link href="/admin/reports" className="hover:underline">
                {reports}
              </Link>
            }
            detalhe="Erros apontados no material de IA"
          />
          <Indicador
            rotulo="Custo de IA no mês"
            valor={fmtUsd(gastoUsd)}
            detalhe={`Teto: ${fmtUsd(configIA().orcamentoMensalUsd)}`}
          />
          <Indicador
            rotulo="Catálogo"
            valor={
              <Link href="/admin/catalogo" className="hover:underline">
                {catalogo}
              </Link>
            }
            detalhe={
              ultimaExecucao
                ? `revisões pendentes · última coleta ${fmtDataHora(ultimaExecucao.startedAt)}`
                : "revisões pendentes · a pipeline ainda não rodou"
            }
          />
        </div>
        {ultimaExecucao ? (
          <p className="text-sm text-muted-foreground">
            Última execução da pipeline: <StatusBadge status={ultimaExecucao.status} /> {ultimaExecucao.examsPublished}{" "}
            publicado(s), {ultimaExecucao.examsModeration} para moderação.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="seguidos" className="grid gap-3">
        <h2 id="seguidos" className="text-sm font-semibold">
          Exames mais seguidos
        </h2>
        {maisSeguidos.length === 0 ? (
          <EmptyState title="Nenhum exame seguido ainda" description="Os mais estudados aparecem aqui." />
        ) : (
          <Tabela rotulo="Exames mais seguidos">
            <thead>
              <tr>
                <th className={th}>Exame</th>
                <th className={`${th} text-right`}>Seguidores ativos</th>
              </tr>
            </thead>
            <tbody>
              {maisSeguidos.map((m) => (
                <tr key={m.examVersionId}>
                  <td className={td}>{codigo.get(m.examVersionId) ?? m.examVersionId}</td>
                  <td className={`${td} tabular text-right`}>{m._count._all}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </section>
    </>
  );
}
