import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Cabecalho({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">{titulo}</h1>
        {descricao ? <p className="text-sm text-muted-foreground">{descricao}</p> : null}
      </div>
      {acoes}
    </div>
  );
}

/** Tabela responsiva: rola na horizontal no mobile, sem quebrar o layout. */
export function Tabela({ children, rotulo }: { children: ReactNode; rotulo: string }) {
  return (
    // Focável e nomeada: no mobile a tabela rola na horizontal, e o teclado precisa alcançar a rolagem.
    <div
      role="region"
      aria-label={rotulo}
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-border bg-surface focus-visible:outline-2 focus-visible:outline-ring"
    >
      <table className="w-full min-w-[640px] text-left text-sm" aria-label={rotulo}>
        {children}
      </table>
    </div>
  );
}

export const th = "border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground";
export const td = "border-b border-border px-3 py-2 align-top last:border-b-0";

export function Paginacao({
  pagina,
  temMais,
  base,
  params = {},
}: {
  pagina: number;
  temMais: boolean;
  base: string;
  params?: Record<string, string>;
}) {
  if (pagina === 1 && !temMais) return null;
  const href = (p: number) => `${base}?${new URLSearchParams({ ...params, pagina: String(p) }).toString()}`;
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-2">
      {pagina > 1 ? (
        <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href={href(pagina - 1)}>
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="tabular text-sm text-muted-foreground">Página {pagina}</span>
      {temMais ? (
        <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href={href(pagina + 1)}>
          Próxima
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

const STATUS: Record<string, { rotulo: string; variant: "neutral" | "primary" | "success" | "warning" | "danger" }> = {
  PENDING: { rotulo: "Pendente", variant: "warning" },
  APPROVED: { rotulo: "Aprovada", variant: "success" },
  REJECTED: { rotulo: "Rejeitada", variant: "danger" },
  SUPERSEDED: { rotulo: "Substituída", variant: "neutral" },
  RUNNING: { rotulo: "Em execução", variant: "primary" },
  SUCCEEDED: { rotulo: "Concluído", variant: "success" },
  PARTIAL: { rotulo: "Parcial", variant: "warning" },
  FAILED: { rotulo: "Falhou", variant: "danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { rotulo: status, variant: "neutral" as const };
  return <Badge variant={s.variant}>{s.rotulo}</Badge>;
}

export function Confianca({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-muted-foreground">—</span>;
  const cor = valor >= 0.85 ? "text-success" : valor >= 0.7 ? "text-warning" : "text-danger";
  return <span className={cn("tabular font-medium", cor)}>{valor.toFixed(2)}</span>;
}

export function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-muted-foreground">{rotulo}</p>
      <p className="tabular mt-1 text-2xl font-semibold">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}
