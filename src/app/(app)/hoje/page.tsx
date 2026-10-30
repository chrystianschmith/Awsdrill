import type { Metadata } from "next";
import Link from "next/link";
import { Play } from "lucide-react";
import { AvisoEmailNaoConfirmado } from "@/lib/auth/components";
import { requireUser } from "@/lib/auth/session";
import { examesSeguidos, preferenciasDeEstudo, proximaProva, segundosPorDiaRecentes } from "@/lib/estudo/consultas";
import { calcularStreak, progressoMeta } from "@/lib/estudo/metas";
import { cicloAtual, proximoDoCiclo } from "@/lib/estudo/servico-ciclo";
import { revisoesVencidas } from "@/lib/estudo/servico-revisoes";
import { getPlan } from "@/lib/assinaturas/plano";
import { entitlementsFor } from "@/lib/assinaturas/entitlements";
import { obterSessaoAtiva } from "@/lib/estudo/servico-sessoes";
import { diasEntre, getDayKey } from "@/lib/estudo/tempo";
import { formatMinutos } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { CabecalhoPagina, Estatistica } from "@/components/estudo/basicos";
import { ListaVencidas } from "@/components/estudo/lista-revisoes";
import { MetaForm } from "@/components/estudo/meta-form";

export const metadata: Metadata = { title: "Hoje" };

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
const fmtHoje = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Sao_Paulo",
});

/** Painel do dia: meta, sequência, prova, próximo domínio do ciclo, revisões vencidas e exames em estudo. */
export default async function HojePage() {
  const user = await requireUser();
  const agora = new Date();
  // Downgrade não apaga ciclo nem revisões: só deixam de aparecer até voltar ao Pro.
  const recursos = entitlementsFor(await getPlan(user.id));
  const [prefs, porDia, ativa, exames, ciclo, vencidas] = await Promise.all([
    preferenciasDeEstudo(user.id),
    segundosPorDiaRecentes(user.id, 400, agora),
    obterSessaoAtiva(user.id),
    examesSeguidos(user.id),
    recursos.cicloEstudos ? cicloAtual(user.id) : null,
    recursos.revisaoEspacada ? revisoesVencidas(user.id, agora, 10) : [],
  ]);
  const proximo = proximoDoCiclo(ciclo);
  const hoje = porDia.get(getDayKey(agora)) ?? 0;
  const meta = progressoMeta(hoje, prefs.dailyGoalMin);
  const streak = calcularStreak(porDia, agora, prefs.streakMinMin);
  const prova = proximaProva(exames, agora);
  const diasProva = prova?.dataProva ? diasEntre(getDayKey(agora), prova.dataProva.toISOString().slice(0, 10)) : null;
  const primeiroNome = user.name.split(/\s+/)[0] ?? user.name;

  return (
    <div className="grid gap-6">
      <CabecalhoPagina
        titulo={`Olá, ${primeiroNome}`}
        descricao={fmtHoje.format(agora)}
        acoes={
          exames.length > 0 || ativa ? (
            <Link href="/estudar" className={buttonVariants({ size: "lg" })}>
              <Play aria-hidden />
              {ativa ? `Continuar: ${ativa.examCode}` : "Iniciar estudo"}
            </Link>
          ) : null
        }
      />
      <AvisoEmailNaoConfirmado />

      <Card>
        <CardContent className="grid gap-6 p-4 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="grid gap-3">
            <div className="flex items-start justify-between gap-2">
              <Estatistica
                rotulo="Estudado hoje"
                valor={formatMinutos(meta.minutos)}
                detalhe={`Meta: ${formatMinutos(prefs.dailyGoalMin)}${meta.atingida ? " · atingida" : ""}`}
              />
              <MetaForm dailyGoalMin={prefs.dailyGoalMin} streakMinMin={prefs.streakMinMin} />
            </div>
            <Progress value={meta.pct} label="Progresso da meta diária" />
          </div>
          <Estatistica
            rotulo="Sequência"
            valor={`${streak} ${streak === 1 ? "dia" : "dias"}`}
            detalhe={`Dias com ${formatMinutos(prefs.streakMinMin)} ou mais`}
          />
          {prova?.dataProva && diasProva !== null ? (
            <Estatistica
              rotulo="Prova"
              valor={diasProva === 0 ? "Hoje" : `${diasProva} ${diasProva === 1 ? "dia" : "dias"}`}
              detalhe={`${prova.codigo} · ${fmtData.format(prova.dataProva)}`}
            />
          ) : (
            <Estatistica
              rotulo="Prova"
              valor="—"
              detalhe={
                <Link href="/exames" className="text-primary-strong underline underline-offset-4">
                  Marque a data da prova
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>

      {proximo ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="grid gap-0.5">
              <p className="text-xs text-muted-foreground">Próximo do ciclo</p>
              <p className="text-sm font-medium">
                {proximo.examCode} · {proximo.codigo}. {proximo.nome}
              </p>
              <p className="tabular text-xs text-muted-foreground">faltam {formatMinutos(proximo.pendenteMin)}</p>
            </div>
            <Link
              href={`/estudar?modo=CICLO&exame=${proximo.examVersionId}&dominio=${proximo.domainId}`}
              className={buttonVariants({ size: "sm" })}
            >
              <Play aria-hidden />
              Estudar agora
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {vencidas.length > 0 ? (
        <section className="grid gap-3" aria-labelledby="revisoes-hoje">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="revisoes-hoje" className="text-sm font-semibold">
              Revisões para hoje <span className="tabular font-normal text-muted-foreground">({vencidas.length})</span>
            </h2>
            <Link href="/revisoes" className="text-xs text-primary-strong underline underline-offset-4">
              Ver todas
            </Link>
          </div>
          <ListaVencidas vencidas={vencidas} agora={agora} />
        </section>
      ) : null}

      {exames.length === 0 ? (
        <EmptyState
          title="Escolha o exame que você vai estudar"
          description="O plano segue os domínios e pesos do exam guide oficial: Cloud Practitioner, AI Practitioner ou Solutions Architect Associate."
          action={
            <Link href="/exames" className={buttonVariants({ size: "sm" })}>
              Escolher exame
            </Link>
          }
        />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2" aria-label="Exames em estudo">
          {exames.map((e) => (
            <Card key={e.examVersionId}>
              <CardHeader>
                <CardTitle>
                  <Link href={`/progresso#${e.codigo}`} className="hover:underline">
                    {e.codigo}
                  </Link>
                </CardTitle>
                <CardDescription>{e.nome}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <p className="text-sm">
                  <span className="tabular font-medium">{e.pct}%</span>{" "}
                  <span className="text-muted-foreground">do blueprint concluído</span>
                </p>
                <Progress value={e.pct} label={`Progresso no ${e.codigo}`} />
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
