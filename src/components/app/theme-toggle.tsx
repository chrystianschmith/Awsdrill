"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTema, type Tema } from "./use-tema";

export const OPCOES_TEMA: { valor: Tema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Claro", Icone: Sun },
  { valor: "escuro", rotulo: "Escuro", Icone: Moon },
  { valor: "sistema", rotulo: "Sistema", Icone: Monitor },
];

/** Alternador de tema em três estados (claro, escuro, seguir o sistema). */
export function ThemeToggle({ className }: { className?: string }) {
  const [tema, definir] = useTema();
  return (
    <div role="group" aria-label="Tema" className={cn("inline-flex rounded-md border border-border p-0.5", className)}>
      {OPCOES_TEMA.map(({ valor, rotulo, Icone }) => (
        <button
          key={valor}
          type="button"
          aria-pressed={tema === valor}
          onClick={() => definir(valor)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-xs text-muted-foreground hover:text-foreground",
            tema === valor && "bg-surface-muted text-foreground",
          )}
        >
          <Icone aria-hidden className="size-3.5" />
          {rotulo}
        </button>
      ))}
    </div>
  );
}
