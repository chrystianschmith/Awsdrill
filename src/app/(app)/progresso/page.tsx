import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { examesSeguidos, historicoSessoes } from "@/lib/estudo/consultas";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { CabecalhoPagina } from "@/components/estudo/basicos";
import { StatusTarefa } from "@/components/estudo/exames-acoes";
import { ListaSessoes } from "@/components/estudo/lista-sessoes";

export const metadata: Metadata = { title: "Progresso" };

export default async function ProgressoPage() {
  const user = await requireUser();
  const [exames, sessoes] = await Promise.all([examesSeguidos(user.id), historicoSessoes(user.id, 30)]);

  if (exames.length === 0) {
    return (
      <div className="grid gap-6">
        <CabecalhoPagina titulo="Progresso" />
        <EmptyState
          title="Nenhum exame em estudo"
          description="Siga um exame para acompanhar o progresso por domínio e tarefa."
          action={
            <Link href="/exames" className={buttonVariants({ size: "sm" })}>
              Escolher exame
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <CabecalhoPagina
        titulo="Progresso"
        descricao="Marque cada tarefa do exam guide conforme avança. O total do exame pondera os domínios pelo peso oficial."
      />
      {exames.map((e) => (
        <Card key={e.examVersionId} id={e.codigo} className="scroll-mt-20">
          <CardHeader>
            <CardTitle>
              {e.codigo} · <span className="tabular">{e.pct}%</span>
            </CardTitle>
            <CardDescription>{e.nome}</CardDescription>
            <Progress value={e.pct} label={`Progresso no ${e.codigo}`} className="mt-2" />
          </CardHeader>
          <CardContent className="grid gap-6">
            {e.dominios.map((d) => (
              <section key={d.id} className="grid gap-2" aria-labelledby={`dom-${d.id}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id={`dom-${d.id}`} className="text-sm font-semibold">
                    {d.codigo}. {d.nome}
                  </h2>
                  <p className="tabular text-xs text-muted-foreground">
                    {d.peso !== null ? `peso ${d.peso}% · ` : "peso a confirmar · "}
                    {d.progresso.concluidos}/{d.progresso.total} tarefas
                  </p>
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {d.tarefas.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-48 flex-1">
                        <span className="tabular text-muted-foreground">{t.codigo}</span> {t.nome}
                      </span>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/material/${t.id}`}
                          className="inline-flex min-h-11 items-center px-1 text-xs text-primary underline underline-offset-4 sm:min-h-0"
                          aria-label={`Material de ${t.codigo}`}
                        >
                          Material
                        </Link>
                        <Link
                          href={`/estudar?exame=${e.examVersionId}&dominio=${d.id}&tarefa=${t.id}`}
                          className="inline-flex min-h-11 items-center px-1 text-xs text-primary underline underline-offset-4 sm:min-h-0"
                          aria-label={`Estudar ${t.codigo}`}
                        >
                          Estudar
                        </Link>
                        <StatusTarefa topicId={t.id} rotulo={`${t.codigo} ${t.nome}`} status={t.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </CardContent>
        </Card>
      ))}
      <section className="grid gap-3" aria-labelledby="historico">
        <h2 id="historico" className="text-sm font-semibold">
          Histórico
        </h2>
        {sessoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sessão registrada ainda.</p>
        ) : (
          <ListaSessoes sessoes={sessoes} />
        )}
      </section>
    </div>
  );
}
