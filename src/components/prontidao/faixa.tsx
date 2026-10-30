import { cn } from "@/lib/utils";

const r = (x: number) => Math.round(x);

/** Estimativa 0–100 com a faixa (limite inferior e superior) em volta. */
export function FaixaProntidao({
  score,
  lowerBound,
  upperBound,
  rotulo,
  className,
}: {
  score: number;
  lowerBound: number;
  upperBound: number;
  rotulo: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`${rotulo}: estimativa ${r(score)} de 100, faixa de ${r(lowerBound)} a ${r(upperBound)}`}
      className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-surface-muted", className)}
    >
      <div
        className="absolute inset-y-0 bg-primary-strong/25"
        style={{ left: `${lowerBound}%`, width: `${Math.max(0, upperBound - lowerBound)}%` }}
      />
      <div className="absolute inset-y-0 left-0 rounded-full bg-primary-strong" style={{ width: `${score}%` }} />
    </div>
  );
}

export function textoFaixa(e: { score: number; lowerBound: number; upperBound: number }) {
  return `${r(e.score)} (faixa ${r(e.lowerBound)}–${r(e.upperBound)})`;
}
