import type * as React from "react";

/**
 * Barra superior preta do template do alibabadrill, nos dois temas. A classe `dark` faz os tokens dentro dela
 * resolverem para a versão escura (texto claro, destaque amarelo).
 */
export function Topbar({ children, abas }: { children: React.ReactNode; abas?: React.ReactNode }) {
  return (
    <header className="dark sticky top-0 z-40 border-b border-border bg-background text-foreground">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:h-16 lg:px-7">{children}</div>
      {abas}
    </header>
  );
}
