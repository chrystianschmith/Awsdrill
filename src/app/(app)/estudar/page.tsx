import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { historicoSessoes, opcoesDeEstudo, preferenciasDeEstudo } from "@/lib/estudo/consultas";
import { obterSessaoAtiva, sessoesAConfirmar } from "@/lib/estudo/servico-sessoes";
import { getDayKey } from "@/lib/estudo/tempo";
import { formatMinutos } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CabecalhoPagina } from "@/components/estudo/basicos";
import { Timer } from "@/components/estudo/timer";
import { LancamentoManual, PomodoroConfig } from "@/components/estudo/formularios-sessao";
import { SessoesAConfirmar } from "@/components/estudo/confirmar-tempo";
import { ListaSessoes } from "@/components/estudo/lista-sessoes";

export const metadata: Metadata = { title: "Estudar" };

const fmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function primeiro(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function EstudarPage({ searchParams }: PageProps<"/estudar">) {
  const user = await requireUser();
  const sp = await searchParams;
  const agora = new Date();
  const [ativa, exames, prefs, pendentes, recentes] = await Promise.all([
    obterSessaoAtiva(user.id),
    opcoesDeEstudo(user.id),
    preferenciasDeEstudo(user.id),
    sessoesAConfirmar(user.id),
    historicoSessoes(user.id, 10),
  ]);

  if (exames.length === 0 && !ativa) {
    return (
      <div className="grid gap-6">
        <CabecalhoPagina titulo="Estudar" />
        <EmptyState
          title="Escolha um exame para começar"
          description="O timer registra o estudo por domínio e tarefa do exam guide do exame que você segue."
          action={
            <Link href="/exames" className={buttonVariants({ size: "sm" })}>
              Escolher exame
            </Link>
          }
        />
      </div>
    );
  }

  const modo = primeiro(sp.modo);
  return (
    <div className="grid gap-6">
      <CabecalhoPagina titulo="Estudar" descricao="Cronometre o estudo por domínio, com Pomodoro ou em modo foco." />
      <SessoesAConfirmar
        sessoes={pendentes.map((p) => ({
          id: p.id,
          durationSec: p.durationSec ?? 0,
          rotulo: `${p.examVersion.code} ${p.domain.code}, ${fmt.format(p.startedAt)} (${formatMinutos((p.durationSec ?? 0) / 60)})`,
        }))}
      />
      <Timer
        ativaInicial={ativa}
        exames={exames}
        pomodoro={{
          trabalhoMin: prefs.pomodoroWorkMin,
          pausaMin: prefs.pomodoroBreakMin,
          pausaLongaMin: prefs.pomodoroLongMin,
          longaACada: prefs.pomodoroLongEvery,
        }}
        inicial={{
          examVersionId: primeiro(sp.exame),
          domainId: primeiro(sp.dominio),
          topicId: primeiro(sp.tarefa),
          mode: modo === "POMODORO" || modo === "FOCO" || modo === "LIVRE" ? modo : undefined,
        }}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lançar estudo manual</CardTitle>
            <CardDescription>Estudou longe do computador? Registre aqui.</CardDescription>
          </CardHeader>
          <CardContent>
            <LancamentoManual exames={exames} hoje={getDayKey(agora)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pomodoro</CardTitle>
            <CardDescription>Blocos de foco com pausas curtas e uma pausa longa periódica.</CardDescription>
          </CardHeader>
          <CardContent>
            <PomodoroConfig
              valores={{
                pomodoroWorkMin: prefs.pomodoroWorkMin,
                pomodoroBreakMin: prefs.pomodoroBreakMin,
                pomodoroLongMin: prefs.pomodoroLongMin,
                pomodoroLongEvery: prefs.pomodoroLongEvery,
              }}
            />
          </CardContent>
        </Card>
      </div>
      <section className="grid gap-3" aria-labelledby="recentes">
        <h2 id="recentes" className="text-sm font-semibold">
          Sessões recentes
        </h2>
        {recentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma sessão ainda. Inicie o timer acima ou lance um estudo manual.
          </p>
        ) : (
          <ListaSessoes sessoes={recentes} />
        )}
      </section>
    </div>
  );
}
