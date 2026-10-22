import type { Metadata } from "next";
import Link from "next/link";
import { Play } from "lucide-react";
import { AvisoEmailNaoConfirmado } from "@/lib/auth/components";
import { requireUser } from "@/lib/auth/session";
import { examesSeguidos, preferenciasDeEstudo, proximaProva, segundosPorDiaRecentes } from "@/lib/estudo/consultas";
import { calcularStreak, progressoMeta } from "@/lib/estudo/metas";
import { obterSessaoAtiva } from "@/lib/estudo/servico-sessoes";
import { diasEntre, getDayKey } from "@/lib/estudo/tempo";
import { formatMinutos } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { CabecalhoPagina, Estatistica } from "@/components/estudo/basicos";
import { MetaForm } from "@/components/estudo/meta-form";

export const metadata: Metadata = { title: "Hoje" };

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
const fmtHoje = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Sao_Paulo",
});

/** Painel do dia: meta, sequência, prova e exames em estudo. Revisões e ciclo entram na etapa 4b. */
export default async function HojePage() {
  const user = await requireUser();
  const agora = new Date();
  const [prefs, porDia, ativa, exames] = await Promise.all([
    preferenciasDeEstudo(user.id),
    segundosPorDiaRecentes(user.id, 400, agora),
    obterSessaoAtiva(user.id),
    examesSeguidos(user.id),
  ]);
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
                <Link href="/exames" className="text-primary underline underline-offset-4">
                  Marque a data da prova
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>

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
