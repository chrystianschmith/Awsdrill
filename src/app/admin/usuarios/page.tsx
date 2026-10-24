import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { resolvePlanForUser } from "@/lib/assinaturas/entitlements";
import { intervaloDoPrice } from "@/lib/assinaturas/stripe";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Cabecalho, Paginacao, Tabela, td, th } from "../_components/ui";
import { fmtData, paginaDe } from "../_lib/formato";

export const metadata = { title: "Usuários · Admin" };

const POR_PAGINA = 50;
const INTERVALO = { MENSAL: "Mensal", ANUAL: "Anual", ANUAL_PIX: "Anual Pix" } as const;

/** Busca por e-mail e plano de cada conta. Só leitura: mudanças de plano vêm do Stripe. */
export default async function Usuarios({ searchParams }: PageProps<"/admin/usuarios">) {
  await requireAdmin();
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const busca = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 100) : "";
  const assinantes = sp.filtro === "assinantes";
  const agora = new Date();

  const usuarios = await db.user.findMany({
    where: {
      deletedAt: null,
      ...(busca ? { email: { contains: busca } } : {}),
      ...(assinantes ? { subscription: { isNot: null } } : {}),
    },
    orderBy: { createdAt: "desc" },
    skip: (pagina - 1) * POR_PAGINA,
    take: POR_PAGINA + 1,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      createdAt: true,
      subscription: {
        select: { status: true, priceId: true, graceUntil: true, accessUntil: true, cancelAtPeriodEnd: true },
      },
      _count: { select: { userExams: true, mockAttempts: true } },
    },
  });
  const temMais = usuarios.length > POR_PAGINA;
  const params: Record<string, string> = {
    ...(busca ? { q: busca } : {}),
    ...(assinantes ? { filtro: "assinantes" } : {}),
  };

  return (
    <>
      <Cabecalho titulo="Usuários" descricao="Contas, plano efetivo e uso. Mudanças de plano só pelo Stripe." />
      <form className="flex flex-wrap items-end gap-2" role="search">
        <label className="grid gap-1 text-sm">
          <span>Buscar por e-mail</span>
          <Input name="q" type="search" defaultValue={busca} className="w-64" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="filtro" value="assinantes" defaultChecked={assinantes} />
          Só quem já assinou
        </label>
        <Button type="submit" size="sm" variant="secondary">
          Filtrar
        </Button>
      </form>
      {usuarios.length === 0 ? (
        <EmptyState title="Nenhum usuário encontrado" description="Mude a busca ou o filtro." />
      ) : (
        <Tabela rotulo="Usuários">
          <thead>
            <tr>
              <th className={th}>Conta</th>
              <th className={th}>Plano</th>
              <th className={th}>Assinatura</th>
              <th className={`${th} text-right`}>Exames</th>
              <th className={`${th} text-right`}>Simulados</th>
              <th className={th}>Desde</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.slice(0, POR_PAGINA).map((u) => {
              const { plan, paymentPending } = resolvePlanForUser(u.role, u.subscription, agora);
              const intervalo = intervaloDoPrice(u.subscription?.priceId ?? null);
              return (
                <tr key={u.id}>
                  <td className={td}>
                    <span className="grid">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {u.email}
                        {u.emailVerifiedAt ? "" : " · não confirmado"}
                      </span>
                    </span>
                  </td>
                  <td className={td}>
                    <span className="flex flex-wrap gap-1">
                      <Badge variant={plan === "PRO" ? "primary" : "neutral"}>
                        {plan === "PRO" ? "Pro" : "Grátis"}
                      </Badge>
                      {u.role === "ADMIN" ? <Badge>Admin</Badge> : null}
                      {paymentPending ? <Badge variant="warning">Pagamento pendente</Badge> : null}
                    </span>
                  </td>
                  <td className={`${td} text-xs`}>
                    {u.subscription
                      ? [
                          u.subscription.status ?? (u.subscription.accessUntil ? "Pix" : "—"),
                          intervalo ? INTERVALO[intervalo] : null,
                          u.subscription.cancelAtPeriodEnd ? "cancela no fim" : null,
                          u.subscription.accessUntil ? `até ${fmtData(u.subscription.accessUntil)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "—"}
                  </td>
                  <td className={`${td} tabular text-right`}>{u._count.userExams}</td>
                  <td className={`${td} tabular text-right`}>{u._count.mockAttempts}</td>
                  <td className={td}>{fmtData(u.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      )}
      <Paginacao pagina={pagina} temMais={temMais} base="/admin/usuarios" params={params} />
    </>
  );
}
