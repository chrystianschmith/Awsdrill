import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { decidirRevisaoCatalogoAction } from "@/lib/admin/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BotaoAcao } from "../_components/botao-acao";
import { Cabecalho, Confianca, StatusBadge, Tabela, td, th } from "../_components/ui";
import { fmtDataHora, fmtDuracao } from "../_lib/formato";

export const metadata = { title: "Catálogo · Admin" };

const lista = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))) : [];

/** Revisões da pipeline mensal que não passaram na confiança, e o histórico de execuções. */
export default async function Catalogo() {
  await requireAdmin();
  const [pendentes, execucoes] = await Promise.all([
    db.catalogReview.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, examCode: true, diff: true, confidence: true, problems: true, createdAt: true },
    }),
    db.catalogRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
  ]);

  return (
    <>
      <Cabecalho
        titulo="Catálogo"
        descricao="Mudanças nos exam guides que a pipeline não publicou sozinha. Aprovar grava exatamente o que foi coletado."
      />
      <section aria-labelledby="pendentes" className="grid gap-3">
        <h2 id="pendentes" className="text-sm font-semibold">
          Revisões pendentes
        </h2>
        {pendentes.length === 0 ? (
          <EmptyState
            title="Nenhuma revisão pendente"
            description="A pipeline publica sozinha o que passa na confiança de 0,85."
          />
        ) : (
          <ul className="grid gap-4">
            {pendentes.map((r) => (
              <li key={r.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{r.examCode}</CardTitle>
                    <CardDescription>
                      Coletado em {fmtDataHora(r.createdAt)} · confiança <Confianca valor={Number(r.confidence)} />
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm">
                    {lista(r.problems).length > 0 ? (
                      <div>
                        <p className="font-medium">Problemas</p>
                        <ul className="list-disc pl-5 text-muted-foreground">
                          {lista(r.problems).map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div>
                      <p className="font-medium">Diferenças</p>
                      <pre className="max-h-80 overflow-auto rounded-md bg-surface-muted p-3 text-xs">
                        {JSON.stringify(r.diff, null, 2)}
                      </pre>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <BotaoAcao
                        acao={decidirRevisaoCatalogoAction.bind(null, { id: r.id, aprovar: true })}
                        rotulo="Aprovar e publicar"
                        sucesso="Catálogo atualizado."
                        variant="primary"
                        confirmar={{
                          titulo: `Publicar a coleta do ${r.examCode}?`,
                          descricao: "O exame passa a usar estes domínios e pesos para todos os usuários.",
                          rotulo: "Publicar",
                        }}
                      />
                      <BotaoAcao
                        acao={decidirRevisaoCatalogoAction.bind(null, { id: r.id, aprovar: false })}
                        rotulo="Rejeitar"
                        sucesso="Coleta rejeitada; não volta para a fila."
                        variant="ghost"
                      />
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="execucoes" className="grid gap-3">
        <h2 id="execucoes" className="text-sm font-semibold">
          Execuções da pipeline
        </h2>
        {execucoes.length === 0 ? (
          <EmptyState title="A pipeline ainda não rodou" description="Ela roda todo mês pelo GitHub Actions." />
        ) : (
          <Tabela rotulo="Execuções da pipeline">
            <thead>
              <tr>
                <th className={th}>Início</th>
                <th className={th}>Status</th>
                <th className={th}>Duração</th>
                <th className={`${th} text-right`}>Conferidos</th>
                <th className={`${th} text-right`}>Publicados</th>
                <th className={`${th} text-right`}>Moderação</th>
                <th className={`${th} text-right`}>Erros</th>
              </tr>
            </thead>
            <tbody>
              {execucoes.map((e) => (
                <tr key={e.id}>
                  <td className={td}>{fmtDataHora(e.startedAt)}</td>
                  <td className={td}>
                    <StatusBadge status={e.status} />
                  </td>
                  <td className={td}>{fmtDuracao(e.startedAt, e.finishedAt)}</td>
                  <td className={`${td} tabular text-right`}>{e.examsChecked}</td>
                  <td className={`${td} tabular text-right`}>{e.examsPublished}</td>
                  <td className={`${td} tabular text-right`}>{e.examsModeration}</td>
                  <td className={`${td} tabular text-right`}>{lista(e.errors).length}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </section>
    </>
  );
}
