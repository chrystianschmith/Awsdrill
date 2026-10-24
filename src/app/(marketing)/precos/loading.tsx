import { Skeleton } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14" aria-busy="true" aria-label="Carregando planos">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      <div className="mt-8 grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
      <Skeleton className="mt-12 h-80 rounded-lg" />
    </main>
  );
}
