import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { obterSimulado, relatorioSimulado } from "@/lib/simulados/servico";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CabecalhoPagina, Estatistica } from "@/components/estudo/basicos";

export const metadata: Metadata = { title: "Relatório do simulado" };

export default async function RelatorioPage({ params }: PageProps<"/simulados/[id]/relatorio">) {
  const user = await requireUser();
  const { id } = await params;
  const rel = await relatorioSimulado(user.id, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === "nao_encontrado") notFound();
    throw e;
  });
  if (!rel) redirect(`/simulados/${id}`);
  const revisao = await obterSimulado(user.id, id);
  const fracos = rel.dominios.filter((d) => d.pct < 70).sort((a, b) => a.pct - b.pct);

  return (
    <div className="grid gap-6">
      <CabecalhoPagina
        titulo={`Relatório · ${rel.examCode}`}
        descricao={`${rel.mode === "PROVA" ? "Prova" : "Treino"}${rel.status === "EXPIRED" ? " encerrada pelo tempo" : ""}. Percentual de acerto nas questões do banco próprio: é treino, não a nota oficial.`}
        acoes={
          <>
            <Link href={`/prontidao#${rel.examCode}`} className={buttonVariants({ variant: "secondary" })}>
              Ver prontidão
            </Link>
            <Link href="/simulados" className={buttonVariants({ variant: "secondary" })}>
              Novo simulado
            </Link>
          </>
        }
      />
      <Card>
        <CardContent className="grid gap-6 p-4 sm:grid-cols-3">
          <Estatistica rotulo="Acertos" valor={`${rel.corretas} de ${rel.total}`} />
          <Estatistica rotulo="Aproveitamento" valor={`${rel.pct}%`} />
          <Estatistica
            rotulo="Para reforçar"
            valor={fracos.length === 0 ? "—" : `${fracos.length} ${fracos.length === 1 ? "domínio" : "domínios"}`}
            detalhe={fracos.length === 0 ? "Todos os domínios com 70% ou mais" : "Abaixo de 70%"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por domínio</CardTitle>
          <CardDescription>Ordem do exam guide.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-4">
            {rel.dominios.map((d) => (
              <li key={d.domainId} className="grid gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {d.codigo}. {d.nome}
                  </span>
                  <span className="tabular text-muted-foreground">
                    {d.corretas}/{d.total} · {d.pct}%
                  </span>
                </div>
                <Progress value={d.pct} label={`Acerto em ${d.codigo}. ${d.nome}`} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <section className="grid gap-3" aria-labelledby="revisao">
        <h2 id="revisao" className="text-sm font-semibold">
          Revisão das questões
        </h2>
        <ol className="grid gap-3">
          {revisao.questoes.map((q, i) => (
            <li key={q.id} className="rounded-lg border border-border bg-surface p-4 text-sm">
              <details>
                <summary className="cursor-pointer">
                  <span className="tabular font-medium">{i + 1}.</span>{" "}
                  <span className={q.feedback?.isCorrect ? "text-success-strong" : "text-danger-strong"}>
                    {q.selecionadas === null ? "Sem resposta" : q.feedback?.isCorrect ? "Certa" : "Errada"}
                  </span>{" "}
                  <span className="text-muted-foreground">· {q.dominio}</span>
                </summary>
                <div className="mt-3 grid gap-2">
                  <p className="whitespace-pre-line">{q.stem}</p>
                  <ul className="grid gap-1">
                    {q.options.map((o) => (
                      <li key={o.key}>
                        <span className="font-medium">{o.key}.</span> {o.text}
                        {q.feedback?.correctKeys.includes(o.key) ? " (correta)" : ""}
                        {q.selecionadas?.includes(o.key) ? " (sua resposta)" : ""}
                      </li>
                    ))}
                  </ul>
                  <p className="whitespace-pre-line text-muted-foreground">{q.feedback?.explanation}</p>
                  {q.feedback?.docUrls.map((u) => (
                    <a
                      key={u}
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-fit text-primary underline underline-offset-4"
                    >
                      Documentação oficial
                    </a>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
