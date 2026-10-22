"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function rotaAtiva(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const estilos = {
  sidebar:
    "flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground aria-[current=page]:bg-primary-soft aria-[current=page]:font-medium aria-[current=page]:text-primary [&_svg]:size-4",
  bottom:
    "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] text-muted-foreground aria-[current=page]:font-medium aria-[current=page]:text-primary [&_svg]:size-5",
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
