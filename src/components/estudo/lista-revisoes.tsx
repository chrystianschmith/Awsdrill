import { diasDeAtraso, INTERVALOS_DIAS } from "@/lib/estudo/revisoes";
import { RevisaoAcoes } from "./revisao-acoes";

type Tarefa = { code: string; nameEn: string; namePt: string | null; examVersion: { code: string } };
export const rotuloTarefa = (t: Tarefa) => `${t.code} ${t.namePt ?? t.nameEn}`;

/** Revisões vencidas, da mais atrasada para a mais recente (também usada no "Hoje"). */
export function ListaVencidas({
  vencidas,
  agora,
}: {
  vencidas: { id: string; step: number; dueAt: Date; topic: Tarefa }[];
  agora: Date;
}) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {vencidas.map((r) => {
        const atraso = diasDeAtraso(r.dueAt, agora);
        const intervalo = INTERVALOS_DIAS[r.step] ?? 30;
        return (
          <li key={r.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="grid gap-1">
              <p className="text-sm font-medium">{rotuloTarefa(r.topic)}</p>
              <p className="tabular text-xs text-muted-foreground">
                {r.topic.examVersion.code} · revisão de {intervalo} {intervalo === 1 ? "dia" : "dias"} ·{" "}
                {atraso === 0 ? "vence hoje" : `${atraso} ${atraso === 1 ? "dia" : "dias"} de atraso`}
              </p>
            </div>
            <RevisaoAcoes reviewId={r.id} />
          </li>
        );
      })}
    </ul>
  );
}
