import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { BotaoPagamento } from "@/app/checkout/_componentes/botao-pagamento";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { requireUser } from "@/lib/auth/session";
import { resolvePlan } from "@/lib/assinaturas/entitlements";
import { formatarDataCurta, formatarDataLonga, rotuloStatus } from "@/lib/assinaturas/formatar";
import { PRECOS } from "@/lib/assinaturas/precos";
import { STATUS_VIVOS } from "@/lib/assinaturas/regras";
import { getStripe, intervaloDoPrice, stripeConfigurado } from "@/lib/assinaturas/stripe";
import { formatBRL } from "@/lib/utils";

export const metadata: Metadata = { title: "Assinatura" };

type Fatura = {
  id: string;
  numero: string | null;
  data: Date;
  centavos: number;
  status: string | null;
  url: string | null;
};

const STATUS_FATURA: Record<string, { rotulo: string; variante: "success" | "warning" | "neutral" | "danger" }> = {
  paid: { rotulo: "Paga", variante: "success" },
  open: { rotulo: "Em aberto", variante: "warning" },
  draft: { rotulo: "Rascunho", variante: "neutral" },
  void: { rotulo: "Cancelada", variante: "neutral" },
  uncollectible: { rotulo: "Não cobrada", variante: "danger" },
};

async function listarFaturas(customer: string): Promise<Fatura[] | null> {
  if (!stripeConfigurado()) return [];
  try {
    const lista = await getStripe().invoices.list({ customer, limit: 12 });
    return lista.data
      .filter((f) => f.status !== "draft")
      .map((f) => ({
        id: f.id,
        numero: f.number,
        data: new Date(f.created * 1000),
        centavos: f.amount_paid || f.amount_due,
        status: f.status,
        url: f.hosted_invoice_url ?? f.invoice_pdf ?? null,
      }));
  } catch (erro) {
    log("error", "assinatura.faturas_falhou", { erro: erro instanceof Error ? erro.message : String(erro) });
    return null;
  }
}

export default async function AssinaturaPage() {
  const user = await requireUser();
  const sub = await db.subscription.findUnique({
    where: { userId: user.id },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      status: true,
      priceId: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      graceUntil: true,
      accessUntil: true,
    },
  });
  const agora = new Date();
  const { plan, paymentPending } = resolvePlan(sub, agora);
  const intervalo = intervaloDoPrice(sub?.priceId ?? null);
  const cartaoVivo = Boolean(sub?.stripeSubscriptionId && sub.status && STATUS_VIVOS.has(sub.status));
  const pixVigente = sub?.accessUntil && sub.accessUntil > agora ? sub.accessUntil : null;
  const faturas = sub ? await listarFaturas(sub.stripeCustomerId) : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">Assinatura</h1>
        <p className="text-sm text-muted-foreground">Plano, pagamentos e faturas.</p>
      </header>

      {paymentPending && sub?.graceUntil ? (
        <Alert
          tone="warning"
          className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <strong className="font-medium">Pagamento pendente.</strong> Não conseguimos cobrar seu cartão. Atualize a
            forma de pagamento até {formatarDataLonga(sub.graceUntil)} para continuar no Pro.
          </span>
          <BotaoPagamento acao={{ tipo: "portal" }} size="sm">
            Atualizar cartão
          </BotaoPagamento>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Plano atual</CardTitle>
            <Badge variant={plan === "PRO" ? "primary" : "neutral"}>{plan === "PRO" ? "Pro" : "Grátis"}</Badge>
          </div>
          <CardDescription>
            {plan === "PRO"
              ? "Todos os recursos liberados."
              : "Um exame por vez, treinos com limite semanal e prontidão geral."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {sub?.stripeSubscriptionId ? (
              <>
                <div>
                  <dt className="text-muted-foreground">Assinatura no cartão</dt>
                  <dd className="font-medium">
                    {rotuloStatus(sub.status)}
                    {intervalo === "MENSAL" ? " · mensal" : intervalo === "ANUAL" ? " · anual" : ""}
                  </dd>
                </div>
                {cartaoVivo && sub.currentPeriodEnd ? (
                  <div>
                    <dt className="text-muted-foreground">
                      {sub.cancelAtPeriodEnd
                        ? "Acesso até"
                        : sub.status === "trialing"
                          ? "Teste grátis até"
                          : "Próxima cobrança"}
                    </dt>
                    <dd className="font-medium tabular">
                      {formatarDataCurta(sub.currentPeriodEnd)}
                      {!sub.cancelAtPeriodEnd && intervalo && intervalo !== "ANUAL_PIX" ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {formatBRL(PRECOS[intervalo].centavos)}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
              </>
            ) : null}
            {pixVigente ? (
              <div>
                <dt className="text-muted-foreground">Acesso anual via Pix até</dt>
                <dd className="font-medium tabular">{formatarDataCurta(pixVigente)}</dd>
              </div>
            ) : null}
          </dl>
          {sub?.cancelAtPeriodEnd && cartaoVivo ? (
            <p className="text-sm text-muted-foreground">
              A renovação está cancelada. Depois dessa data a conta volta ao Grátis, sem perder dados.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {plan === "FREE" ? (
              <Link href="/precos" className={buttonVariants()}>
                Ver plano Pro
              </Link>
            ) : null}
            {pixVigente && !cartaoVivo ? (
              <BotaoPagamento acao={{ tipo: "checkout", intervalo: "ANUAL_PIX" }} variant="secondary">
                Renovar com Pix
              </BotaoPagamento>
            ) : null}
            {sub ? (
              <BotaoPagamento acao={{ tipo: "portal" }} variant="secondary">
                {cartaoVivo ? "Gerenciar assinatura" : "Dados de pagamento e recibos"}
              </BotaoPagamento>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="faturas" className="flex flex-col gap-3">
        <h2 id="faturas" className="text-sm font-semibold">
          Faturas
        </h2>
        {faturas === null ? (
          <Alert tone="danger">Não foi possível carregar as faturas agora. Recarregue a página em instantes.</Alert>
        ) : faturas.length === 0 ? (
          <EmptyState
            title="Nenhuma fatura ainda"
            description="As faturas e recibos dos seus pagamentos aparecem aqui."
            action={
              plan === "FREE" ? (
                <Link href="/precos" className={buttonVariants({ size: "sm", variant: "secondary" })}>
                  Conhecer o Pro
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Número
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Valor
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Situação
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {faturas.map((f) => {
                  const st = STATUS_FATURA[f.status ?? ""] ?? { rotulo: f.status ?? "—", variante: "neutral" as const };
                  return (
                    <tr key={f.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2 tabular">{formatarDataCurta(f.data)}</td>
                      <td className="px-4 py-2 tabular">{f.numero ?? "—"}</td>
                      <td className="px-4 py-2 tabular">{formatBRL(f.centavos)}</td>
                      <td className="px-4 py-2">
                        <Badge variant={st.variante}>{st.rotulo}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {f.url ? (
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary-strong underline-offset-4 hover:underline"
                          >
                            Ver
                            <ExternalLink aria-hidden className="size-3.5" />
                            <span className="sr-only">fatura {f.numero ?? ""} (abre em nova aba)</span>
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
