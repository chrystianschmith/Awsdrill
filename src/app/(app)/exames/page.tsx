import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { examesParaSeguir, examesSeguidos } from "@/lib/estudo/consultas";
import { getDayKey } from "@/lib/estudo/tempo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CabecalhoPagina } from "@/components/estudo/basicos";
import { DataProvaForm, DeixarDeSeguir, SeguirExame } from "@/components/estudo/exames-acoes";

export const metadata: Metadata = { title: "Exames" };

export default async function ExamesPage() {
  const user = await requireUser();
  const [seguidos, disponiveis] = await Promise.all([examesSeguidos(user.id), examesParaSeguir(user.id)]);
  const hoje = getDayKey(new Date());

  return (
    <div className="grid gap-6">
      <CabecalhoPagina
        titulo="Exames"
        descricao="Escolha os exames que você estuda. O progresso segue os domínios e pesos do exam guide oficial."
      />

      <section className="grid gap-3" aria-labelledby="seguidos">
        <h2 id="seguidos" className="text-sm font-semibold">
          Estudando
        </h2>
        {seguidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não segue nenhum exame. Escolha um abaixo.</p>
        ) : (
          <ul className="grid gap-3">
            {seguidos.map((e) => (
              <li key={e.examVersionId}>
                <Card>
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <div className="grid gap-1">
                      <CardTitle>{e.codigo}</CardTitle>
                      <CardDescription>{e.nome}</CardDescription>
                    </div>
                    <DeixarDeSeguir examVersionId={e.examVersionId} codigo={e.codigo} />
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-2">
                      <p className="text-sm">
                        <span className="tabular font-medium">{e.pct}%</span>{" "}
                        <span className="text-muted-foreground">das tarefas concluídas, ponderado pelos pesos</span>
                      </p>
                      <Progress value={e.pct} label={`Progresso no ${e.codigo}`} />
                    </div>
                    <DataProvaForm
                      examVersionId={e.examVersionId}
                      codigo={e.codigo}
                      valor={e.dataProva ? e.dataProva.toISOString().slice(0, 10) : ""}
                      hoje={hoje}
                    />
                    <p className="text-sm">
                      <Link href={`/progresso#${e.codigo}`} className="text-primary underline underline-offset-4">
                        Ver domínios e tarefas
                      </Link>
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {disponiveis.length > 0 ? (
        <section className="grid gap-3" aria-labelledby="disponiveis">
          <h2 id="disponiveis" className="text-sm font-semibold">
            Disponíveis
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {disponiveis.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="grid">
                  <span className="font-medium">{e.codigo}</span>
                  <span className="text-sm text-muted-foreground">{e.nome}</span>
                </div>
                <SeguirExame examVersionId={e.id} codigo={e.codigo} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
