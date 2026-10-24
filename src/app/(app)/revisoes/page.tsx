import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { proximasRevisoes, revisoesVencidas } from "@/lib/estudo/servico-revisoes";
import { temRecurso } from "@/lib/assinaturas/plano";
import { UpgradeCta } from "@/components/app/upgrade-cta";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CabecalhoPagina } from "@/components/estudo/basicos";
import { ListaVencidas, rotuloTarefa } from "@/components/estudo/lista-revisoes";

export const metadata: Metadata = { title: "Revisões" };

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function RevisoesPage() {
  const user = await requireUser();
  if (!(await temRecurso(user.id, "revisaoEspacada")))
    return (
      <div className="grid gap-6">
        <CabecalhoPagina
          titulo="Revisões"
          descricao="Revise cada tarefa concluída em 1, 7 e 30 dias para fixar o conteúdo."
        />
        <UpgradeCta
          feature="revisaoEspacada"
          description="Ao concluir uma tarefa, a revisão é agendada sozinha e aparece no Hoje no dia certo."
        />
      </div>
    );
  const agora = new Date();
  const [vencidas, proximas] = await Promise.all([revisoesVencidas(user.id, agora), proximasRevisoes(user.id, agora)]);

  return (
    <div className="grid gap-6">
      <CabecalhoPagina
        titulo="Revisões"
        descricao="Revise bem e o intervalo aumenta (1, 7, 30 dias). Com dificuldade, a tarefa volta amanhã."
      />

      <section className="grid gap-3" aria-labelledby="titulo-vencidas">
        <h2 id="titulo-vencidas" className="text-sm font-semibold">
          Para hoje <span className="tabular font-normal text-muted-foreground">({vencidas.length})</span>
        </h2>
        {vencidas.length === 0 ? (
          <EmptyState
            title="Tudo revisado"
            description="Nenhuma revisão pendente. Marque tarefas como concluídas para agendar as próximas revisões."
            action={
              <Link href="/progresso" className={buttonVariants({ size: "sm", variant: "secondary" })}>
                Ver progresso
              </Link>
            }
          />
        ) : (
          <ListaVencidas vencidas={vencidas} agora={agora} />
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="titulo-proximas">
        <h2 id="titulo-proximas" className="text-sm font-semibold">
          Próximos 7 dias
        </h2>
        {proximas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma revisão agendada para a próxima semana.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface text-sm">
            {proximas.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  {rotuloTarefa(r.topic)} <span className="text-muted-foreground">· {r.topic.examVersion.code}</span>
                </span>
                <span className="tabular text-xs text-muted-foreground">{fmtData.format(r.dueAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
