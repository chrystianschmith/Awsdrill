import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { BotaoPagamento } from "@/app/checkout/_componentes/botao-pagamento";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { ENTITLEMENTS, FEATURE_LABELS, type Entitlements, type PlanKey } from "@/lib/assinaturas/entitlements";
import { getEffectivePlan } from "@/lib/assinaturas/plano";
import {
  PRECOS,
  economiaAnualCentavos,
  mensalEquivalenteAnualCentavos,
  type Intervalo,
} from "@/lib/assinaturas/precos";
import { FAQ_ASSINATURA as FAQ } from "@/lib/assinaturas/faq";
import { urlEntrarComPlano } from "@/lib/assinaturas/funil";
import { env } from "@/lib/env";
import { cn, formatBRL } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Preços",
  description: "Compare os planos Grátis e Pro. Pro por R$ 29,90 por mês ou R$ 239,00 por ano, no cartão ou via Pix.",
};

type Recurso = keyof Entitlements;
const RECURSOS = Object.keys(FEATURE_LABELS) as Recurso[];

function ehRecurso(v: unknown): v is Recurso {
  return typeof v === "string" && (RECURSOS as string[]).includes(v);
}

function Valor({ recurso, valor }: { recurso: Recurso; valor: number | boolean }) {
  if (typeof valor === "boolean") {
    return valor ? (
      <>
        <Check aria-hidden className="size-4 text-primary" />
        <span className="sr-only">Incluído</span>
      </>
    ) : (
      <>
        <Minus aria-hidden className="size-4 text-muted-foreground" />
        <span className="sr-only">Não incluído</span>
      </>
    );
  }
  if (!Number.isFinite(valor)) return <span>Ilimitado</span>;
  return <span className="tabular">{recurso === "treinosPorSemana" ? `${valor} por semana` : valor}</span>;
}

function Cta({
  intervalo,
  logado,
  plano,
  children,
}: {
  intervalo: Intervalo;
  logado: boolean;
  plano: PlanKey | null;
  children: string;
}) {
  const variante = intervalo === "ANUAL" ? "primary" : "secondary";
  if (!logado) {
    return (
      <Link href={urlEntrarComPlano(intervalo)} className={cn(buttonVariants({ variant: variante }), "w-full")}>
        {children}
      </Link>
    );
  }
  // Pro no cartão gerencia pelo portal; o Pix anual pode ser renovado a qualquer momento.
  if (plano === "PRO" && intervalo !== "ANUAL_PIX") {
    return (
      <Link href="/conta/assinatura" className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
        Gerenciar assinatura
      </Link>
    );
  }
  return (
    <BotaoPagamento acao={{ tipo: "checkout", intervalo }} variant={variante} className="w-full">
      {children}
    </BotaoPagamento>
  );
}

export default async function PrecosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { recurso } = await searchParams;
  const destaque = ehRecurso(recurso) ? recurso : null;

  const user = await getCurrentUser();
  const plano = user ? (await getEffectivePlan(user.id)).plan : null;
  const trialDias = env().STRIPE_TRIAL_DAYS;
  const economia = economiaAnualCentavos();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Planos</h1>
        <p className="mt-2 text-muted-foreground">
          Comece grátis com um exame e simulados de treino. Assine o Pro para treinar no modo prova, ver a prontidão por
          domínio e estudar com material, ciclo e revisões em quantos exames quiser.
        </p>
      </header>

      {destaque ? (
        <p role="status" className="mt-6 rounded-lg border border-primary/30 bg-primary-soft px-4 py-3 text-sm">
          <strong className="font-medium">{FEATURE_LABELS[destaque]}</strong> faz parte do plano Pro. Veja abaixo o que
          muda.
        </p>
      ) : null}

      <section aria-labelledby="planos" className="mt-8 grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <h2 id="planos" className="sr-only">
          Opções de plano
        </h2>

        <div className="flex flex-col rounded-lg border border-border bg-surface p-5">
          <h3 className="font-semibold">Grátis</h3>
          <p className="mt-2 text-3xl font-semibold tabular">{formatBRL(0)}</p>
          <p className="text-sm text-muted-foreground">Para conhecer a plataforma com um exame.</p>
          <ul className="mt-4 grid gap-2 text-sm">
            {RECURSOS.filter((r) => ENTITLEMENTS.FREE[r] !== false).map((r) => (
              <li key={r} className="flex items-start gap-2">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  {FEATURE_LABELS[r]}
                  {typeof ENTITLEMENTS.FREE[r] === "number" ? (
                    <span className="tabular text-muted-foreground">: {ENTITLEMENTS.FREE[r]}</span>
                  ) : null}
                </span>
              </li>
            ))}
            <li className="flex items-start gap-2">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Prontidão geral, timer, metas e carteira de certificações</span>
            </li>
          </ul>
          <div className="mt-auto pt-6">
            {user ? (
              <p className="text-sm text-muted-foreground">
                {plano === "FREE" ? "Seu plano atual." : "Incluído na sua conta."}
              </p>
            ) : (
              <Link href="/cadastro" className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
                Criar conta grátis
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col rounded-lg border-2 border-primary bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Pro</h3>
            {plano === "PRO" ? <Badge variant="primary">Seu plano</Badge> : null}
          </div>
          {trialDias > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {trialDias} dias grátis no cartão para a primeira assinatura.
            </p>
          ) : null}

          <ul className="mt-4 divide-y divide-border">
            <li className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-medium">Mensal</p>
                <p className="text-sm text-muted-foreground">
                  <span className="tabular text-base font-semibold text-foreground">
                    {formatBRL(PRECOS.MENSAL.centavos)}
                  </span>{" "}
                  por mês, no cartão
                </p>
              </div>
              <div className="sm:w-44">
                <Cta intervalo="MENSAL" logado={Boolean(user)} plano={plano}>
                  Assinar mensal
                </Cta>
              </div>
            </li>
            <li className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  Anual
                  {economia > 0 ? (
                    <Badge variant="success">
                      Economize <span className="tabular">{formatBRL(economia)}</span>
                    </Badge>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="tabular text-base font-semibold text-foreground">
                    {formatBRL(PRECOS.ANUAL.centavos)}
                  </span>{" "}
                  por ano no cartão, o mesmo que{" "}
                  <span className="tabular">{formatBRL(mensalEquivalenteAnualCentavos())}</span> por mês
                </p>
              </div>
              <div className="sm:w-44">
                <Cta intervalo="ANUAL" logado={Boolean(user)} plano={plano}>
                  Assinar anual
                </Cta>
              </div>
            </li>
            <li className="grid gap-3 py-4 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-medium">Anual via Pix</p>
                <p className="text-sm text-muted-foreground">
                  <span className="tabular text-base font-semibold text-foreground">
                    {formatBRL(PRECOS.ANUAL_PIX.centavos)}
                  </span>{" "}
                  à vista, 12 meses de acesso, sem renovação automática
                </p>
              </div>
              <div className="sm:w-44">
                <Cta intervalo="ANUAL_PIX" logado={Boolean(user)} plano={plano}>
                  Pagar com Pix
                </Cta>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="comparativo" className="mt-12">
        <h2 id="comparativo" className="text-lg font-semibold">
          O que cada plano inclui
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[22rem] border-collapse bg-surface text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-4 py-3 font-medium">
                  Recurso
                </th>
                <th scope="col" className="w-28 px-4 py-3 font-medium sm:w-40">
                  Grátis
                </th>
                <th scope="col" className="w-28 px-4 py-3 font-medium sm:w-40">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {RECURSOS.map((r) => (
                <tr
                  key={r}
                  id={`recurso-${r}`}
                  aria-current={r === destaque ? "true" : undefined}
                  className={cn("border-b border-border last:border-b-0", r === destaque && "bg-primary-soft")}
                >
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    {FEATURE_LABELS[r]}
                  </th>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center">
                      <Valor recurso={r} valor={ENTITLEMENTS.FREE[r]} />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center">
                      <Valor recurso={r} valor={ENTITLEMENTS.PRO[r]} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="faq" className="mt-12 max-w-3xl">
        <h2 id="faq" className="text-lg font-semibold">
          Perguntas frequentes
        </h2>
        <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
          {FAQ.map((item) => (
            <details key={item.pergunta} className="group px-4 py-3">
              <summary className="cursor-pointer list-none font-medium marker:hidden">{item.pergunta}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{item.resposta}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
