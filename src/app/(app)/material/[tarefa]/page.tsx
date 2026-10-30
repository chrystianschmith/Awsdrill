import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { iaDisponivel } from "@/lib/ai/cliente";
import { lerMaterial, tarefaDoUsuario } from "@/lib/ai/servico-material";
import { AppError } from "@/lib/errors";
import { temRecurso } from "@/lib/assinaturas/plano";
import { UpgradeCta } from "@/components/app/upgrade-cta";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CabecalhoPagina } from "@/components/estudo/basicos";
import { TextoIA } from "@/components/material/texto-ia";
import { GerarMaterial, ReportarErro } from "@/components/material/acoes-material";

export const metadata: Metadata = { title: "Material da tarefa" };

const fmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

export default async function MaterialPage({ params }: PageProps<"/material/[tarefa]">) {
  const user = await requireUser();
  const { tarefa: topicId } = await params;
  const tarefa = await tarefaDoUsuario(user.id, topicId).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const titulo = `${tarefa.exame.codigo} · ${tarefa.codigo} ${tarefa.nome}`;
  const atalhos = (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/estudar?exame=${tarefa.exame.id}&dominio=${tarefa.dominio.id}&tarefa=${tarefa.id}`}
        className={buttonVariants({ variant: "secondary", size: "sm" })}
      >
        Cronometrar estudo
      </Link>
      <Link
        href={`/simulados?exame=${tarefa.exame.id}&dominio=${tarefa.dominio.id}`}
        className={buttonVariants({ variant: "secondary", size: "sm" })}
      >
        Treinar o domínio {tarefa.dominio.codigo}
      </Link>
    </div>
  );

  if (!(await temRecurso(user.id, "conteudoIA"))) {
    return (
      <div className="grid gap-6">
        <CabecalhoPagina
          titulo={titulo}
          descricao={`Domínio ${tarefa.dominio.codigo}. ${tarefa.dominio.nome}`}
          acoes={atalhos}
        />
        <UpgradeCta
          feature="conteudoIA"
          description="Resumo e flashcards de cada tarefa do exam guide, com as fontes oficiais citadas."
        />
      </div>
    );
  }

  const material = await lerMaterial(tarefa.id);
  if (!material) {
    return (
      <div className="grid gap-6">
        <CabecalhoPagina
          titulo={titulo}
          descricao={`Domínio ${tarefa.dominio.codigo}. ${tarefa.dominio.nome}`}
          acoes={atalhos}
        />
        {iaDisponivel() ? (
          <Card>
            <CardHeader>
              <CardTitle>Material ainda não gerado</CardTitle>
              <CardDescription>
                Resumo, flashcards e questões desta tarefa são gerados por IA uma única vez e ficam disponíveis para
                todos. As questões passam por revisão antes de entrar nos simulados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GerarMaterial topicId={tarefa.id} />
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            title="Material ainda não disponível"
            description="O material com IA desta tarefa ainda não foi gerado. Enquanto isso, estude pelo exam guide e treine com os simulados."
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <CabecalhoPagina
        titulo={titulo}
        descricao={`Domínio ${tarefa.dominio.codigo}. ${tarefa.dominio.nome}`}
        acoes={atalhos}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Resumo
            <Badge variant="primary">Gerado por IA</Badge>
          </CardTitle>
          <CardDescription>
            Gerado em {fmt.format(material.geradoEm)}. Pode conter erros: confira nas fontes oficiais e reporte o que
            estiver errado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <TextoIA texto={material.resumo.texto} />
          <section className="grid gap-1.5" aria-labelledby="fontes">
            <h2 id="fontes" className="text-sm font-semibold">
              Fontes oficiais
            </h2>
            <ul className="grid gap-1 text-sm">
              {material.resumo.fontes.map((url) => (
                <li key={url} className="break-all">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-strong underline underline-offset-4"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <div>
            <ReportarErro topicId={tarefa.id} contentType="summary" contentId={material.resumo.id} rotulo="resumo" />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3" aria-labelledby="flashcards">
        <h2 id="flashcards" className="flex flex-wrap items-center gap-2 font-semibold">
          Flashcards
          <Badge variant="primary">Gerado por IA</Badge>
        </h2>
        <ul className="grid gap-2">
          {material.flashcards.map((f, i) => (
            <li key={f.id} className="rounded-lg border border-border bg-surface">
              <details className="group">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
                  {f.frente}
                  <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
                    mostrar resposta
                  </span>
                </summary>
                <div className="grid gap-2 border-t border-border px-4 py-3 text-sm">
                  <p>{f.verso}</p>
                  <div>
                    <ReportarErro
                      topicId={tarefa.id}
                      contentType="flashcard"
                      contentId={f.id}
                      rotulo={`flashcard ${i + 1}`}
                    />
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
