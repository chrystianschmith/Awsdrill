import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { decidirMaterialAction, resolverReportAction } from "@/lib/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BotaoAcao } from "../_components/botao-acao";
import { Cabecalho, Paginacao } from "../_components/ui";
import { fmtDataHora, paginaDe } from "../_lib/formato";

export const metadata = { title: "Reports · Admin" };

const POR_PAGINA = 50;
const TIPO: Record<string, string> = { summary: "Resumo", flashcard: "Flashcard" };

/** Erros apontados no material de IA, agrupados por tarefa (a decisão útil é por tarefa). */
export default async function Reports({ searchParams }: PageProps<"/admin/reports">) {
  await requireAdmin();
  const pagina = paginaDe((await searchParams).pagina);
  const reports = await db.contentReport.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "asc" },
    skip: (pagina - 1) * POR_PAGINA,
    take: POR_PAGINA + 1,
    select: {
      id: true,
      contentType: true,
      message: true,
      createdAt: true,
      topic: {
        select: {
          id: true,
          code: true,
          nameEn: true,
          namePt: true,
          examVersion: { select: { code: true } },
          summary: { select: { published: true, promptVersion: true } },
        },
      },
    },
  });
  const temMais = reports.length > POR_PAGINA;
  const porTarefa = new Map<string, { topic: (typeof reports)[number]["topic"]; itens: typeof reports }>();
  for (const r of reports.slice(0, POR_PAGINA)) {
    const g = porTarefa.get(r.topic.id) ?? { topic: r.topic, itens: [] };
    g.itens.push(r);
    porTarefa.set(r.topic.id, g);
  }

  return (
    <>
      <Cabecalho
        titulo="Reports do material de IA"
        descricao="Mais de 3 reports abertos tiram o material da tarefa do ar. Republique se estiver certo ou apague para gerar de novo."
      />
      {porTarefa.size === 0 ? (
        <EmptyState
          title="Nenhum report aberto"
          description="Quando alguém reportar um erro em resumo ou flashcard, ele aparece aqui."
        />
      ) : (
        <ul className="grid gap-4">
          {[...porTarefa.values()].map(({ topic, itens }) => {
            const nome = `${topic.examVersion.code} · ${topic.code} ${topic.namePt ?? topic.nameEn}`;
            return (
              <li key={topic.id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{nome}</CardTitle>
                      {topic.summary ? (
                        <Badge variant={topic.summary.published ? "success" : "danger"}>
                          {topic.summary.published ? "No ar" : "Fora do ar"}
                        </Badge>
                      ) : (
                        <Badge>Sem material</Badge>
                      )}
                    </div>
                    <CardDescription>
                      {itens.length} report(s){topic.summary ? ` · prompt ${topic.summary.promptVersion}` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm">
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {itens.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
                          <span className="grid gap-0.5">
                            <span className="text-xs text-muted-foreground">
                              {TIPO[r.contentType] ?? r.contentType} · {fmtDataHora(r.createdAt)}
                            </span>
                            <span className="whitespace-pre-line">{r.message}</span>
                          </span>
                          <BotaoAcao
                            acao={resolverReportAction.bind(null, r.id)}
                            rotulo="Resolver"
                            sucesso="Report resolvido."
                            variant="ghost"
                          />
                        </li>
                      ))}
                    </ul>
                    {topic.summary ? (
                      <div className="flex flex-wrap gap-2">
                        <BotaoAcao
                          acao={decidirMaterialAction.bind(null, { topicId: topic.id, decisao: "republicar" })}
                          rotulo="Republicar"
                          sucesso="Material de volta ao ar."
                        />
                        <BotaoAcao
                          acao={decidirMaterialAction.bind(null, { topicId: topic.id, decisao: "regerar" })}
                          rotulo="Apagar para gerar de novo"
                          sucesso="Material apagado; a próxima visita de um assinante gera de novo."
                          variant="danger"
                          confirmar={{
                            titulo: "Apagar o material desta tarefa?",
                            descricao:
                              "Resumo e flashcards são apagados e os reports, resolvidos. Gerar de novo consome IA.",
                            rotulo: "Apagar",
                          }}
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Paginacao pagina={pagina} temMais={temMais} base="/admin/reports" />
    </>
  );
}
