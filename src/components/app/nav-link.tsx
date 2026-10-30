"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function rotaAtiva(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Como no alibabadrill: no desktop, item da barra lateral com faixa amarela à esquerda; no mobile, abas
// horizontais com sublinhado amarelo.
const estilos = {
  sidebar:
    "flex items-center gap-3 rounded-md border-l-[3px] border-transparent px-3.5 py-2 text-[0.94rem] font-semibold text-muted-foreground hover:bg-background hover:text-foreground aria-[current=page]:border-primary-strong aria-[current=page]:bg-background aria-[current=page]:text-foreground",
  tab: "-mb-px flex shrink-0 items-center border-b-[3px] border-transparent px-3 py-3 text-[0.94rem] font-semibold text-muted-foreground hover:text-foreground aria-[current=page]:border-primary-strong aria-[current=page]:text-foreground",
} as const;

/** Link de navegação que destaca a página atual (aria-current="page"). */
export function NavLink({
  href,
  icon,
  children,
  variant = "sidebar",
  className,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: keyof typeof estilos;
  className?: string;
}) {
  const pathname = usePathname();
  const ativo = rotaAtiva(pathname, href);
  return (
    <Link href={href} aria-current={ativo ? "page" : undefined} className={cn(estilos[variant], className)}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
