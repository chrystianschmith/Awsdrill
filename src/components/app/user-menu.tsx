"use client";

import Link from "next/link";
import { useRef } from "react";
import { DropdownMenu as M } from "radix-ui";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { sair } from "@/lib/auth/actions";
import { OPCOES_TEMA } from "./theme-toggle";
import { useTema, type Tema } from "./use-tema";

export type LinkMenu = { href: string; label: string };

const item =
  "flex h-9 cursor-default select-none items-center gap-2 rounded-sm px-2 text-sm outline-none data-[highlighted]:bg-surface-muted [&_svg]:size-4 [&_svg]:text-muted-foreground";

/** Menu do usuário: nome, e-mail, tema, links da conta e sair. */
export function UserMenu({
  nome,
  email,
  links,
  linksMobile = [],
  compact = false,
}: {
  nome: string;
  email: string;
  links: LinkMenu[];
  linksMobile?: LinkMenu[];
  compact?: boolean;
}) {
  const [tema, definirTema] = useTema();
  const formSair = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formSair} action={sair} className="hidden" />
      <M.Root>
        <M.Trigger
          aria-label={`Menu de ${nome}`}
          className={cn(
            "flex items-center gap-2 rounded-md text-left text-sm hover:bg-surface-muted",
            compact ? "h-10 px-2" : "h-12 w-full px-3",
          )}
        >
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-muted text-xs font-semibold uppercase"
          >
            {nome.slice(0, 1)}
          </span>
          {compact ? null : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{nome}</span>
              </span>
              <ChevronsUpDown aria-hidden className="size-4 text-muted-foreground" />
            </>
          )}
        </M.Trigger>
        <M.Portal>
          <M.Content
            align={compact ? "end" : "start"}
            side={compact ? "bottom" : "top"}
            sideOffset={6}
            className="z-50 w-64 rounded-lg border border-border bg-surface p-1 shadow-sm"
          >
            <div className="px-2 py-2">
              <p className="truncate text-sm font-medium">{nome}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <M.Separator className="my-1 h-px bg-border" />
            {linksMobile.length > 0 ? (
              <M.Group className="md:hidden">
                {linksMobile.map((l) => (
                  <M.Item key={l.href} asChild className={item}>
                    <Link href={l.href}>{l.label}</Link>
                  </M.Item>
                ))}
                <M.Separator className="my-1 h-px bg-border" />
              </M.Group>
            ) : null}
            {links.map((l) => (
              <M.Item key={l.href} asChild className={item}>
                <Link href={l.href}>{l.label}</Link>
              </M.Item>
            ))}
            <M.Separator className="my-1 h-px bg-border" />
            <M.Label className="px-2 pb-1 pt-1.5 text-xs text-muted-foreground">Tema</M.Label>
            <M.RadioGroup value={tema} onValueChange={(v) => definirTema(v as Tema)}>
              {OPCOES_TEMA.map(({ valor, rotulo, Icone }) => (
                <M.RadioItem
                  key={valor}
                  value={valor}
                  className={cn(item, "data-[state=checked]:font-medium data-[state=checked]:text-primary")}
                >
                  <Icone aria-hidden />
                  {rotulo}
                </M.RadioItem>
              ))}
            </M.RadioGroup>
            <M.Separator className="my-1 h-px bg-border" />
            <M.Item className={item} onSelect={() => formSair.current?.requestSubmit()}>
              <LogOut aria-hidden />
              Sair
            </M.Item>
          </M.Content>
        </M.Portal>
      </M.Root>
    </>
  );
}
