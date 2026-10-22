import Link from "next/link";
import { BookOpenCheck, ChartColumn, CircleUser, House, RefreshCw, Repeat, Timer } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavLink } from "@/components/app/nav-link";
import { RegistrarSW } from "@/components/app/registrar-sw";
import { SkipLink } from "@/components/app/skip-link";
import { UserMenu, type LinkMenu } from "@/components/app/user-menu";
import { requireUser } from "@/lib/auth/session";

// Simulados e prontidão entram na etapa 5.
const PRINCIPAIS = [
  { href: "/hoje", label: "Hoje", Icone: House },
  { href: "/estudar", label: "Estudar", Icone: Timer },
  { href: "/revisoes", label: "Revisões", Icone: RefreshCw },
  { href: "/ciclo", label: "Ciclo", Icone: Repeat },
  { href: "/progresso", label: "Progresso", Icone: ChartColumn },
  { href: "/exames", label: "Exames", Icone: BookOpenCheck },
  { href: "/conta", label: "Conta", Icone: CircleUser },
] as const;

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const linksMenu: LinkMenu[] = [{ href: "/conta", label: "Conta" }];
  const linksMobile: LinkMenu[] = [
    { href: "/hoje", label: "Hoje" },
    { href: "/estudar", label: "Estudar" },
    { href: "/revisoes", label: "Revisões" },
    { href: "/ciclo", label: "Ciclo" },
    { href: "/progresso", label: "Progresso" },
    { href: "/exames", label: "Exames" },
  ];

  return (
    <>
      <SkipLink />
      <RegistrarSW />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center px-5">
          <Link href="/hoje" aria-label="Início">
            <Logo />
          </Link>
        </div>
        <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="grid gap-0.5">
            {PRINCIPAIS.map(({ href, label, Icone }) => (
              <li key={href}>
                <NavLink href={href} icon={<Icone aria-hidden />}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-border p-2">
          <UserMenu nome={user.name} email={user.email} links={linksMenu} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <Link href="/hoje" aria-label="Início">
          <Logo />
        </Link>
        <UserMenu compact nome={user.name} email={user.email} links={linksMenu} linksMobile={linksMobile} />
      </header>

      <div className="md:pl-60">
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-5xl px-4 pb-10 pt-6 outline-none md:px-8">
          {children}
        </main>
      </div>
    </>
  );
}
