import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" aria-busy="true" aria-label="Carregando assinatura">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-44 w-full rounded-lg" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
