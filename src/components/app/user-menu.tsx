"use client";

import Link from "next/link";
import { useRef } from "react";
import { DropdownMenu as M } from "radix-ui";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { sair } from "@/lib/auth/actions";
import { OPCOES_TEMA } from "./theme-toggle";
import { useTema, type Tema } from "./use-tema";

export type LinkMenu = { href: string; label: string };

const item =
  "flex h-9 cursor-default select-none items-center gap-2 rounded-sm px-2 text-sm outline-none data-[highlighted]:bg-surface-muted [&_svg]:size-4 [&_svg]:text-muted-foreground";

/** Menu do usuário na barra superior (pílula com avatar, como no alibabadrill): conta, tema e sair. */
export function UserMenu({ nome, email, links }: { nome: string; email: string; links: LinkMenu[] }) {
  const [tema, definirTema] = useTema();
  const formSair = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formSair} action={sair} className="hidden" />
      <M.Root>
        <M.Trigger
          aria-label={`Menu de ${nome}`}
          className="flex min-h-10 items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-1.5 text-left text-[0.94rem] font-semibold hover:border-primary-strong sm:pr-3"
        >
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold uppercase text-primary-foreground"
          >
            {nome.slice(0, 1)}
          </span>
          <span className="hidden max-w-[12ch] truncate sm:block">{nome}</span>
        </M.Trigger>
        <M.Portal>
          <M.Content
            align="end"
            side="bottom"
            sideOffset={8}
            className="z-50 w-64 rounded-lg border border-border bg-surface p-1 shadow-sm"
          >
            <div className="px-2 py-2">
              <p className="truncate text-sm font-medium">{nome}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <M.Separator className="my-1 h-px bg-border" />
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
                  className={cn(item, "data-[state=checked]:font-medium data-[state=checked]:text-primary-strong")}
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
