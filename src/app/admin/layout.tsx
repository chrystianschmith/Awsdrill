import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { requireAdmin } from "@/lib/auth/session";
import { AdminNav } from "./_components/nav";

export const metadata: Metadata = { title: "Administração", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" className="inline-flex items-center gap-2">
              <Logo />
              <span className="text-sm text-muted-foreground">Admin</span>
            </Link>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="hidden sm:inline">{admin.email}</span>
              <Link href="/hoje" className="text-primary underline-offset-4 hover:underline">
                Voltar ao app
              </Link>
            </div>
          </div>
          <div className="pb-2">
            <AdminNav />
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}
