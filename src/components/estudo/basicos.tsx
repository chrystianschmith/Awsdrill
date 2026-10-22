import type { ReactNode } from "react";

export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        {descricao ? <p className="text-sm text-muted-foreground">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap gap-2">{acoes}</div> : null}
    </header>
  );
}

/** Número de destaque com rótulo (tile de estatística). */
export function Estatistica({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
      <p className="tabular text-2xl font-semibold leading-none">{valor}</p>
      {detalhe ? <p className="text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}
