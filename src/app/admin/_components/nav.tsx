"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITENS = [
  { href: "/admin", rotulo: "Visão geral" },
  { href: "/admin/questoes", rotulo: "Questões" },
  { href: "/admin/reports", rotulo: "Reports" },
  { href: "/admin/catalogo", rotulo: "Catálogo" },
  { href: "/admin/custo", rotulo: "Custo de IA" },
  { href: "/admin/usuarios", rotulo: "Usuários" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administração" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1">
        {ITENS.map((i) => {
          const ativo = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                  ativo && "bg-surface-muted font-medium text-foreground",
                )}
              >
                {i.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
