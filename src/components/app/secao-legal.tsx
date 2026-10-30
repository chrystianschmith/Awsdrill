import type * as React from "react";

/** Seção das páginas de termos e privacidade. */
export function SecaoLegal({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-bold tracking-tight">{titulo}</h2>
      <div className="grid gap-3 text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}
