import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { NavLink } from "@/components/app/nav-link";
import { RegistrarSW } from "@/components/app/registrar-sw";
import { SkipLink } from "@/components/app/skip-link";
import { Topbar } from "@/components/app/topbar";
import { UserMenu, type LinkMenu } from "@/components/app/user-menu";
import { requireUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";

type Item = { href: string; label: string };

const GRUPOS: { titulo: string; links: Item[] }[] = [
  {
    titulo: "Estudo",
    links: [
      { href: "/hoje", label: "Hoje" },
      { href: "/estudar", label: "Estudar" },
      { href: "/simulados", label: "Simulados" },
      { href: "/revisoes", label: "Revisões" },
      { href: "/ciclo", label: "Ciclo" },
    ],
  },
  {
    titulo: "Acompanhamento",
    links: [
      { href: "/prontidao", label: "Prontidão" },
      { href: "/progresso", label: "Progresso" },
      { href: "/exames", label: "Exames" },
      { href: "/carteira", label: "Carteira" },
    ],
  },
];

const TODOS = GRUPOS.flatMap((g) => g.links);

/**
 * Casca do app no template do alibabadrill: barra superior preta de largura total; no desktop, barra lateral fixa
 * abaixo dela; no mobile e tablet, abas horizontais roláveis logo abaixo da barra.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const linksMenu: LinkMenu[] = [
    { href: "/conta", label: "Conta" },
    { href: "/conta/assinatura", label: "Assinatura" },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Administração" }] : []),
  ];

  return (
    <>
      <SkipLink />
      <RegistrarSW />

      <Topbar
        abas={
          <nav aria-label="Seções" className="overflow-x-auto px-2 [scrollbar-width:none] lg:hidden">
            <ul className="flex gap-1">
              {TODOS.map(({ href, label }) => (
                <li key={href}>
                  <NavLink href={href} variant="tab">
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        }
      >
        <Link href="/hoje" aria-label={`${BRAND.name}, início`} className="rounded-md">
          <Logo />
        </Link>
        <UserMenu nome={user.name} email={user.email} links={linksMenu} />
      </Topbar>

      <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-64 overflow-y-auto border-r border-border bg-surface px-3 pb-10 pt-5 lg:block">
        <nav aria-label="Principal" className="flex flex-col gap-5">
          {GRUPOS.map((g, i) => (
            <div key={g.titulo} className="flex flex-col gap-1">
              <p
                className={
                  i === 0
                    ? "px-3.5 pb-1 text-sm font-bold text-muted-foreground"
                    : "mx-3.5 border-t border-border pb-1 pt-5 text-sm font-bold text-muted-foreground"
                }
              >
                {g.titulo}
              </p>
              <ul className="flex flex-col gap-0.5">
                {g.links.map(({ href, label }) => (
                  <li key={href}>
                    <NavLink href={href}>{label}</NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto max-w-6xl px-4 pb-16 pt-6 outline-none lg:px-12 lg:pb-20 lg:pt-10"
        >
          {children}
        </main>
      </div>
    </>
  );
}
