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
    <nav aria-label="Administração" className="overflow-x-auto px-2 [scrollbar-width:none] lg:px-5">
      <ul className="flex min-w-max gap-1">
        {ITENS.map((i) => {
          const ativo = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center border-b-[3px] border-transparent px-3 py-3 text-[0.94rem] font-semibold text-muted-foreground hover:text-foreground",
                  ativo && "border-primary-strong text-foreground",
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
