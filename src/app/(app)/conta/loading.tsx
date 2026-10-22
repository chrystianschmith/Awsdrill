import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6" aria-busy="true" aria-label="Carregando">
      <div className="grid gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}
