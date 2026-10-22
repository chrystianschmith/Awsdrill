import { Badge } from "@/components/ui/badge";
import { emSaoPaulo, getDayKey } from "@/lib/estudo/tempo";
import { formatMinutos } from "@/lib/utils";
import { ExcluirSessao } from "./formularios-sessao";

type Sessao = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSec: number | null;
  manual: boolean;
  autoClosed: boolean;
  examVersion: { code: string };
  domain: Rotulo;
  topic: Rotulo | null;
};

type Rotulo = { code: string; nameEn: string; namePt: string | null };
const nome = (r: Rotulo) => `${r.code}${r.code.includes(".") ? "" : "."} ${r.namePt ?? r.nameEn}`;

const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });

function hora(d: Date) {
  const z = emSaoPaulo(d);
  return `${String(z.getHours()).padStart(2, "0")}:${String(z.getMinutes()).padStart(2, "0")}`;
}

/** Lista de sessões encerradas, agrupada por dia (São Paulo). */
export function ListaSessoes({ sessoes, permitirExcluir = true }: { sessoes: Sessao[]; permitirExcluir?: boolean }) {
  const grupos = new Map<string, Sessao[]>();
  for (const s of sessoes) {
    const k = getDayKey(s.startedAt);
    grupos.set(k, [...(grupos.get(k) ?? []), s]);
  }
  return (
    <div className="grid gap-4">
      {[...grupos].map(([dia, lista]) => {
        const total = lista.reduce((a, s) => a + (s.durationSec ?? 0), 0);
        return (
          <section key={dia} className="grid gap-1">
            <h3 className="flex items-baseline justify-between text-xs font-medium text-muted-foreground">
              <span>{fmtDia.format(lista[0]!.startedAt)}</span>
              <span className="tabular">{formatMinutos(total / 60)}</span>
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {lista.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {s.examVersion.code} · {nome(s.domain)}
                      {s.topic ? <span className="text-muted-foreground"> · {nome(s.topic)}</span> : null}
                    </p>
                    <p className="tabular text-xs text-muted-foreground">
                      {hora(s.startedAt)}–{s.endedAt ? hora(s.endedAt) : "agora"}
                    </p>
                  </div>
                  {s.manual ? <Badge>Manual</Badge> : null}
                  {s.autoClosed ? <Badge variant="warning">A confirmar</Badge> : null}
                  <span className="tabular w-14 text-right">{formatMinutos((s.durationSec ?? 0) / 60)}</span>
                  {permitirExcluir ? (
                    <ExcluirSessao
                      sessionId={s.id}
                      rotulo={`${s.examVersion.code}, ${fmtDia.format(s.startedAt)} às ${hora(s.startedAt)}`}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
