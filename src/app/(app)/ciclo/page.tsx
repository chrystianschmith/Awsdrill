import type { Metadata } from "next";
import Link from "next/link";
import { Play } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { examesSeguidos } from "@/lib/estudo/consultas";
import { progressoCiclo, proximoDominio, saldoPendente } from "@/lib/estudo/ciclo";
import { cicloAtual } from "@/lib/estudo/servico-ciclo";
import { formatMinutos } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { CabecalhoPagina } from "@/components/estudo/basicos";
import { CicloForm, EncerrarCiclo } from "@/components/estudo/ciclo-form";

export const metadata: Metadata = { title: "Ciclo de estudos" };

export default async function CicloPage() {
  const user = await requireUser();
  const [ciclo, exames] = await Promise.all([cicloAtual(user.id), examesSeguidos(user.id)]);
  const proximo = ciclo ? proximoDominio(ciclo.items) : null;
  const doCiclo = exames.find((e) => e.examVersionId === ciclo?.examVersionId);

  return (
    <div className="grid gap-6">
      <CabecalhoPagina
        titulo="Ciclo de estudos"
        descricao="Estude sempre o domínio com mais tempo pendente. Quando todos cumprem a carga, um novo ciclo começa."
      />
      {exames.length === 0 ? (
        <EmptyState
          title="Siga um exame para montar o ciclo"
          description="O ciclo distribui as horas pelos domínios do exam guide, de acordo com o peso de cada um."
          action={
            <Link href="/exames" className={buttonVariants({ size: "sm" })}>
              Escolher exame
            </Link>
          }
        />
      ) : null}

      {ciclo ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                {ciclo.examVersion.code} · ciclo {ciclo.number}{" "}
                <span className="tabular font-normal text-muted-foreground">· {formatMinutos(ciclo.totalMin)}</span>
              </CardTitle>
              <EncerrarCiclo />
            </div>
            <CardDescription className="tabular">{progressoCiclo(ciclo.items)}% concluído</CardDescription>
            <Progress value={progressoCiclo(ciclo.items)} label="Progresso do ciclo" />
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {ciclo.items.map((i) => {
                const pct = i.targetMin === 0 ? 100 : Math.min(100, Math.round((i.doneMin / i.targetMin) * 100));
                const ehProximo = proximo?.domainId === i.domainId;
                const nome = `${i.domain.code}. ${i.domain.namePt ?? i.domain.nameEn}`;
                return (
                  <li key={i.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_14rem_auto] sm:items-center">
                    <span className="inline-flex flex-wrap items-center gap-2 text-sm font-medium">
                      {nome}
                      {ehProximo ? <Badge variant="primary">Próximo</Badge> : null}
                    </span>
                    <span className="grid gap-1">
                      <span className="tabular text-xs text-muted-foreground sm:text-right">
                        {formatMinutos(i.doneMin)} de {formatMinutos(i.targetMin)}
                        {saldoPendente(i) > 0 ? ` · faltam ${formatMinutos(saldoPendente(i))}` : " · cumprida"}
                      </span>
                      <Progress value={pct} label={`Carga cumprida em ${nome}`} className="h-1.5" />
                    </span>
                    {saldoPendente(i) > 0 ? (
                      <Link
                        href={`/estudar?modo=CICLO&exame=${ciclo.examVersionId}&dominio=${i.domainId}`}
                        className={buttonVariants({ size: "sm", variant: ehProximo ? "primary" : "secondary" })}
                        aria-label={`Estudar ${nome}`}
                      >
                        <Play aria-hidden />
                        Estudar
                      </Link>
                    ) : (
                      <span />
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {exames.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{ciclo ? "Montar novo ciclo" : "Montar ciclo"}</CardTitle>
            <CardDescription>
              A carga de cada domínio segue o peso dele no exam guide, com no mínimo 30 minutos. Quando houver
              simulados, domínios com menor acerto ganham mais tempo.
              {ciclo ? " Criar um novo ciclo encerra o atual." : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CicloForm
              exames={exames.map((e) => ({
                id: e.examVersionId,
                codigo: e.codigo,
                dominios: e.dominios.map((d) => ({ id: d.id, rotulo: `${d.codigo}. ${d.nome}`, peso: d.peso })),
              }))}
              inicial={{
                examVersionId: doCiclo?.examVersionId ?? exames[0]!.examVersionId,
                domainIds: ciclo ? ciclo.items.map((i) => i.domainId) : (exames[0]?.dominios.map((d) => d.id) ?? []),
                horas: ciclo ? ciclo.totalMin / 60 : 10,
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
