import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { configIA } from "@/lib/ai/config";
import { mesCorrente } from "@/lib/ai/orcamento";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Cabecalho, Indicador, Tabela, td, th } from "../_components/ui";
import { fmtPct, fmtUsd } from "../_lib/formato";

export const metadata = { title: "Custo de IA · Admin" };

type LinhaMes = { mes: string; chamadas: bigint; entrada: bigint; saida: bigint; cache: bigint; custo: number };

const MESES_HISTORICO = 12;
const nomeMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

function rotuloMes(chave: string): string {
  const [ano = 1970, mes = 1] = chave.split("-").map(Number);
  return nomeMes.format(new Date(Date.UTC(ano, mes - 1, 1)));
}

export default async function Custo() {
  await requireAdmin();
  const agora = new Date();
  const { inicio } = mesCorrente(agora);
  const limite = configIA().orcamentoMensalUsd;
  const desde = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - (MESES_HISTORICO - 1), 1));

  const [porMes, porModelo] = await Promise.all([
    // Agrupa pelo mês do fuso de São Paulo, o mesmo usado pelo teto mensal.
    db.$queryRaw<LinhaMes[]>`
      SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS mes,
             count(*) AS chamadas,
             coalesce(sum("inputTokens"), 0) AS entrada,
             coalesce(sum("outputTokens"), 0) AS saida,
             coalesce(sum("cachedTokens"), 0) AS cache,
             coalesce(sum("costUsd"), 0)::float8 AS custo
        FROM "AiUsageLog"
       WHERE "createdAt" >= ${desde}
       GROUP BY 1
       ORDER BY 1 DESC`,
    db.aiUsageLog.groupBy({
      by: ["model", "purpose"],
      where: { createdAt: { gte: inicio } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true, cachedTokens: true },
      _count: { _all: true },
      orderBy: { _sum: { costUsd: "desc" } },
    }),
  ]);

  const gastoMes = porModelo.reduce((s, m) => s + Number(m._sum.costUsd ?? 0), 0);
  const uso = limite > 0 ? gastoMes / limite : 0;

  return (
    <>
      <Cabecalho
        titulo="Custo de IA"
        descricao="Gasto estimado com IA a partir do AiUsageLog (preços de tabela, sem impostos; Gemini grátis conta como zero)."
      />

      {uso >= 1 ? (
        <Alert tone="danger">
          O teto mensal foi atingido. A geração de material fica pausada até o mês virar ou o teto
          (AI_MONTHLY_BUDGET_USD) subir.
        </Alert>
      ) : uso >= 0.8 ? (
        <Alert tone="warning">Mais de 80% do teto mensal já foi usado.</Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador rotulo="Gasto no mês" valor={fmtUsd(gastoMes)} detalhe="Mês corrente, horário de Brasília" />
        <Indicador rotulo="Teto mensal" valor={fmtUsd(limite)} detalhe="AI_MONTHLY_BUDGET_USD" />
        <Indicador
          rotulo="Uso do teto"
          valor={fmtPct(uso)}
          detalhe={uso >= 1 ? "Geração pausada" : "Geração liberada"}
        />
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-label="Uso do teto mensal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(uso, 1) * 100)}
      >
        <div
          className={uso >= 1 ? "h-full bg-danger" : uso >= 0.8 ? "h-full bg-warning" : "h-full bg-primary-strong"}
          style={{ width: `${Math.min(uso, 1) * 100}%` }}
        />
      </div>

      <section aria-labelledby="por-modelo" className="grid gap-3">
        <h2 id="por-modelo" className="text-sm font-semibold">
          Este mês por modelo e finalidade
        </h2>
        {porModelo.length === 0 ? (
          <EmptyState
            title="Nenhuma chamada neste mês"
            description="As chamadas que geram o material de cada tarefa aparecem aqui."
          />
        ) : (
          <Tabela rotulo="Custo por modelo e finalidade">
            <thead>
              <tr>
                <th className={th}>Modelo</th>
                <th className={th}>Finalidade</th>
                <th className={`${th} text-right`}>Chamadas</th>
                <th className={`${th} text-right`}>Entrada</th>
                <th className={`${th} text-right`}>Cache</th>
                <th className={`${th} text-right`}>Saída</th>
                <th className={`${th} text-right`}>Custo</th>
              </tr>
            </thead>
            <tbody>
              {porModelo.map((m) => (
                <tr key={`${m.model}-${m.purpose}`}>
                  <td className={td}>{m.model}</td>
                  <td className={td}>{m.purpose}</td>
                  <td className={`${td} tabular text-right`}>{m._count._all.toLocaleString("pt-BR")}</td>
                  <td className={`${td} tabular text-right`}>{(m._sum.inputTokens ?? 0).toLocaleString("pt-BR")}</td>
                  <td className={`${td} tabular text-right`}>{(m._sum.cachedTokens ?? 0).toLocaleString("pt-BR")}</td>
                  <td className={`${td} tabular text-right`}>{(m._sum.outputTokens ?? 0).toLocaleString("pt-BR")}</td>
                  <td className={`${td} tabular text-right`}>{fmtUsd(m._sum.costUsd ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </section>

      <section aria-labelledby="historico" className="grid gap-3">
        <h2 id="historico" className="text-sm font-semibold">
          Últimos {MESES_HISTORICO} meses
        </h2>
        {porMes.length === 0 ? (
          <EmptyState title="Sem histórico" description="Nenhuma chamada de IA foi registrada ainda." />
        ) : (
          <Tabela rotulo="Custo por mês">
            <thead>
              <tr>
                <th className={th}>Mês</th>
                <th className={`${th} text-right`}>Chamadas</th>
                <th className={`${th} text-right`}>Entrada</th>
                <th className={`${th} text-right`}>Cache</th>
                <th className={`${th} text-right`}>Saída</th>
                <th className={`${th} text-right`}>Custo</th>
                <th className={`${th} text-right`}>Do teto</th>
              </tr>
            </thead>
            <tbody>
              {porMes.map((m) => (
                <tr key={m.mes}>
                  <td className={`${td} capitalize`}>{rotuloMes(m.mes)}</td>
                  <td className={`${td} tabular text-right`}>{Number(m.chamadas).toLocaleString("pt-BR")}</td>
                  <td className={`${td} tabular text-right`}>{Number(m.entrada).toLocaleString("pt-BR")}</td>
                  <td className={`${td} tabular text-right`}>{Number(m.cache).toLocaleString("pt-BR")}</td>
                  <td className={`${td} tabular text-right`}>{Number(m.saida).toLocaleString("pt-BR")}</td>
                  <td className={`${td} tabular text-right`}>{fmtUsd(m.custo)}</td>
                  <td className={`${td} tabular text-right`}>{limite > 0 ? fmtPct(m.custo / limite) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </section>
    </>
  );
}
