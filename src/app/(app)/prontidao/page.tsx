import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { examesSeguidos } from "@/lib/estudo/consultas";
import { MINIMO_EXAME } from "@/lib/prontidao/calculo";
import { prontidaoDoExame, type ItemCorrecaoDTO } from "@/lib/prontidao/servico";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CabecalhoPagina, Estatistica } from "@/components/estudo/basicos";
import { FaixaProntidao, textoFaixa } from "@/components/prontidao/faixa";

export const metadata: Metadata = { title: "Prontidão" };

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
const pct = (x: number) => `${Math.round(x * 100)}%`;

const MOTIVO: Record<ItemCorrecaoDTO["motivo"], string> = {
  sem_respostas: "Ainda sem questões respondidas",
  amostra_pequena: "Poucas questões respondidas",
  acerto_baixo: "Acerto abaixo de 70",
};

export default async function ProntidaoPage() {
  const user = await requireUser();
  const seguidos = await examesSeguidos(user.id);
  const exames = await Promise.all(
    seguidos.map(async (e) => ({ ...e, p: await prontidaoDoExame(user.id, e.examVersionId) })),
  );

  return (
    <div className="grid gap-6">
      <CabecalhoPagina
        titulo="Prontidão"
        descricao="Estimativa de 0 a 100 do seu domínio do conteúdo, a partir dos seus simulados. Não é nota prevista do exame nem garantia de aprovação."
        acoes={
          <Link href="/metodologia" className={buttonVariants({ variant: "secondary" })}>
            Como calculamos
          </Link>
        }
      />
      {exames.length === 0 ? (
        <EmptyState
          title="Siga um exame para medir a prontidão"
          description="A prontidão é calculada por domínio e tarefa do exam guide, a partir das questões que você responde."
          action={
            <Link href="/exames" className={buttonVariants({ size: "sm" })}>
              Escolher exame
            </Link>
          }
        />
      ) : null}
      {exames.map(({ examVersionId, codigo, nome, p }) => (
        <Card key={examVersionId} id={codigo} className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {codigo}
              <Badge>estimativa</Badge>
              {!p.suficiente ? <Badge variant="warning">amostra pequena</Badge> : null}
            </CardTitle>
            <CardDescription>{nome}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Estatistica
                rotulo="Prontidão"
                valor={Math.round(p.score)}
                detalhe={`faixa ${Math.round(p.lowerBound)}–${Math.round(p.upperBound)}`}
              />
              <Estatistica rotulo="Cobertura" valor={pct(p.coverage)} detalhe="das tarefas, pelo peso do domínio" />
              <Estatistica
                rotulo="Respostas"
                valor={p.sampleSize}
                detalhe={
                  p.suficiente
                    ? "nos últimos 180 dias"
                    : `responda mais ${MINIMO_EXAME - p.sampleSize} para sair da amostra pequena`
                }
              />
            </div>
            <FaixaProntidao {...p} rotulo={`Prontidão no ${codigo}`} />

            <section className="grid gap-3" aria-labelledby={`dom-${examVersionId}`}>
              <h2 id={`dom-${examVersionId}`} className="text-sm font-semibold">
                Por domínio
              </h2>
              <ul className="grid gap-4">
                {p.dominios.map((d) => {
                  const r = p.rotulos[d.domainId]!;
                  return (
                    <li key={d.domainId} className="grid gap-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">
                          {r.codigo}. {r.nome}
                        </span>
                        <span className="tabular text-xs text-muted-foreground">
                          {textoFaixa(d)} · peso {Math.round(d.peso)}% · cobertura {pct(d.coverage)}
                        </span>
                      </div>
                      <FaixaProntidao {...d} rotulo={`${r.codigo}. ${r.nome}`} />
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="grid gap-3" aria-labelledby={`plano-${examVersionId}`}>
              <h2 id={`plano-${examVersionId}`} className="text-sm font-semibold">
                Plano de correção
              </h2>
              {p.plano.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todas as tarefas cobertas e com 70 ou mais. Mantenha com simulados em modo prova.
                </p>
              ) : (
                <ol className="divide-y divide-border rounded-lg border border-border text-sm">
                  {p.plano.map((item) => (
                    <li
                      key={item.topicId ?? item.domainId}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span>
                          <span className="tabular text-muted-foreground">{item.codigo}</span> {item.nome}
                        </span>
                        <span className="text-xs text-muted-foreground">{MOTIVO[item.motivo]}</span>
                      </span>
                      <span className="flex items-center gap-3 text-xs">
                        {item.topicId ? (
                          <Link
                            href={`/material/${item.topicId}`}
                            className="text-primary underline underline-offset-4"
                            aria-label={`Material de ${item.codigo}`}
                          >
                            Material
                          </Link>
                        ) : null}
                        <Link
                          href={`/estudar?exame=${examVersionId}&dominio=${item.domainId}${item.topicId ? `&tarefa=${item.topicId}` : ""}`}
                          className="text-primary underline underline-offset-4"
                          aria-label={`Estudar ${item.codigo}`}
                        >
                          Estudar
                        </Link>
                        <Link
                          href={`/simulados?exame=${examVersionId}&dominio=${item.domainId}`}
                          className="text-primary underline underline-offset-4"
                          aria-label={`Treinar o domínio ${item.dominio}`}
                        >
                          Treinar
                        </Link>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {p.historico.length > 0 ? (
              <section className="grid gap-2" aria-labelledby={`hist-${examVersionId}`}>
                <h2 id={`hist-${examVersionId}`} className="text-sm font-semibold">
                  Ao fim dos últimos simulados
                </h2>
                <ul className="flex flex-wrap gap-2 text-xs">
                  {p.historico.map((h) => (
                    <li key={h.computedAt.toISOString()} className="tabular rounded-sm bg-surface-muted px-2 py-1">
                      {fmt.format(h.computedAt)} · {Math.round(h.score)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
