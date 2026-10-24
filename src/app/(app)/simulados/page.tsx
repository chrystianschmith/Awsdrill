import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { examesSeguidos } from "@/lib/estudo/consultas";
import { bancoDoExame, historicoSimulados, simuladoEmAndamento, treinosNaSemana } from "@/lib/simulados/servico";
import { getPlan } from "@/lib/assinaturas/plano";
import { entitlementsFor } from "@/lib/assinaturas/entitlements";
import { UpgradeCta } from "@/components/app/upgrade-cta";
import { db } from "@/lib/db";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CabecalhoPagina } from "@/components/estudo/basicos";
import { IniciarSimulado } from "@/components/simulados/iniciar-form";

export const metadata: Metadata = { title: "Simulados" };

const fmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export default async function SimuladosPage({ searchParams }: PageProps<"/simulados">) {
  const user = await requireUser();
  const { exame, dominio } = await searchParams;
  const [seguidos, andamento, historico, plano, feitos] = await Promise.all([
    examesSeguidos(user.id),
    simuladoEmAndamento(user.id),
    historicoSimulados(user.id),
    getPlan(user.id).then(entitlementsFor),
    treinosNaSemana(user.id),
  ]);
  const treinosRestantes = Number.isFinite(plano.treinosPorSemana)
    ? Math.max(0, plano.treinosPorSemana - feitos)
    : null;
  const formatos = await db.examVersion.findMany({
    where: { id: { in: seguidos.map((e) => e.examVersionId) } },
    select: { id: true, questionCount: true, durationMinutes: true },
  });
  const exames = await Promise.all(
    seguidos.map(async (e) => {
      const f = formatos.find((x) => x.id === e.examVersionId);
      const banco = await bancoDoExame(e.examVersionId);
      return {
        id: e.examVersionId,
        codigo: e.codigo,
        totalQuestoes: f?.questionCount ?? null,
        duracaoMin: f?.durationMinutes ?? null,
        dominios: banco.map((d) => ({ id: d.id, rotulo: `${d.codigo}. ${d.nome}`, questoes: d.questoes })),
      };
    }),
  );
  const semBanco = exames.length > 0 && exames.every((e) => e.dominios.every((d) => d.questoes === 0));

  return (
    <div className="grid gap-6">
      <CabecalhoPagina
        titulo="Simulados"
        descricao="Questões próprias, sorteadas na proporção dos pesos do exam guide. Nenhuma é questão real de prova."
      />
      {andamento ? (
        <Alert tone="info" className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Você tem um {andamento.mode === "PROVA" ? "simulado em modo prova" : "treino"} de {andamento.examCode} em
            andamento. Começar outro encerra este com o que já foi respondido.
          </span>
          <Link href={`/simulados/${andamento.id}`} className={buttonVariants({ size: "sm" })}>
            Continuar
          </Link>
        </Alert>
      ) : null}

      {exames.length === 0 ? (
        <EmptyState
          title="Siga um exame para fazer simulados"
          description="Os simulados seguem os domínios e os pesos do exam guide do exame escolhido."
          action={
            <Link href="/exames" className={buttonVariants({ size: "sm" })}>
              Escolher exame
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Novo simulado</CardTitle>
            <CardDescription>
              {semBanco
                ? "O banco de questões ainda está em revisão. Assim que as primeiras forem publicadas, os simulados abrem aqui."
                : "No treino você vê a correção a cada questão; na prova, só no relatório final."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {treinosRestantes !== null ? (
              <p className="tabular text-sm text-muted-foreground">
                {treinosRestantes === 0
                  ? "Você usou os treinos desta semana. Eles voltam na segunda-feira."
                  : `${treinosRestantes} de ${plano.treinosPorSemana} treinos restantes nesta semana.`}
              </p>
            ) : null}
            <IniciarSimulado
              exames={exames}
              plano={{ modoProva: plano.modoProva, treinoEsgotado: treinosRestantes === 0 }}
              inicial={
                typeof exame === "string" && exames.some((e) => e.id === exame)
                  ? { examVersionId: exame, domainId: typeof dominio === "string" ? dominio : null }
                  : undefined
              }
            />
            {treinosRestantes === 0 ? (
              <UpgradeCta feature="treinosPorSemana" description="No Pro os treinos não têm limite." />
            ) : !plano.modoProva ? (
              <UpgradeCta
                feature="modoProva"
                description="Simulado com o número de questões e o tempo oficiais, corrigido só no final."
              />
            ) : null}
          </CardContent>
        </Card>
      )}

      <section className="grid gap-3" aria-labelledby="historico">
        <h2 id="historico" className="text-sm font-semibold">
          Histórico
        </h2>
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum simulado ainda.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface text-sm">
            {historico.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  {h.examCode} · {h.mode === "PROVA" ? "Prova" : "Treino"}{" "}
                  <span className="tabular text-muted-foreground">· {fmt.format(h.startedAt)}</span>
                </span>
                {h.status === "IN_PROGRESS" ? (
                  <Link href={`/simulados/${h.id}`} className="text-primary underline underline-offset-4">
                    Continuar
                  </Link>
                ) : (
                  <Link
                    href={`/simulados/${h.id}/relatorio`}
                    className="tabular text-primary underline underline-offset-4"
                    aria-label={`Relatório: ${h.corretas ?? 0} de ${h.total}`}
                  >
                    {h.corretas ?? 0}/{h.total} · relatório
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
