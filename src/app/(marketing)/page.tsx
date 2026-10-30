import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { listarCertificacoes } from "@/lib/catalogo/consultas";
import { ROTULO_NIVEL } from "@/lib/catalogo/rotulos";
import { BRAND } from "@/lib/brand";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} · certificações de nuvem` },
  description: BRAND.tagline,
};

const COMO_FUNCIONA = [
  { titulo: "Plano pelo blueprint", texto: "Estudo distribuído pelos domínios e pesos do guia oficial de cada exame." },
  {
    titulo: "Simulados por domínio",
    texto: "Modo treino com explicação e link para a documentação; modo prova com tempo real.",
  },
  {
    titulo: "Prontidão medida",
    texto: "Uma estimativa por domínio, com metodologia publicada, antes de você marcar a prova.",
  },
];

const DESTAQUES = ["Domínios e pesos do guia oficial", "Treino e prova com tempo real", "Revisão 1/7/30"];

export default async function Inicio({ searchParams }: PageProps<"/">) {
  const contaExcluida = (await searchParams).conta === "excluida";
  const [exames, user] = await Promise.all([listarCertificacoes(), getCurrentUser()]);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-12 sm:py-16 lg:gap-14">
      {contaExcluida ? (
        <Alert tone="success" role="status">
          Sua conta foi excluída e seus dados pessoais foram apagados.
        </Alert>
      ) : null}
      <div className="flex flex-col gap-4">
        <p className="font-semibold text-primary-strong">Certificações de nuvem em português</p>
        <h1 className="max-w-3xl text-[clamp(1.9rem,6vw,2.6rem)] leading-[1.12] text-balance">
          Do primeiro exame de nuvem até a recertificação, com plano e prontidão medida
        </h1>
        <p className="max-w-[60ch] text-lg text-muted-foreground">{BRAND.tagline}</p>
        <ul aria-label="Destaques" className="flex flex-wrap gap-2">
          {DESTAQUES.map((d) => (
            <li key={d} className="rounded-full border border-border bg-surface px-3 py-1.5 text-[0.94rem]">
              {d}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-3">
          {user ? (
            <Link href="/hoje" className={buttonVariants({ size: "lg" })}>
              Ir para o painel
            </Link>
          ) : (
            <Link href="/cadastro" className={buttonVariants({ size: "lg" })}>
              Começar grátis
            </Link>
          )}
          <Link href="/precos" className={buttonVariants({ variant: "secondary", size: "lg" })}>
            Comparar planos
          </Link>
        </div>
      </div>

      <section aria-labelledby="exames" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="exames" className="text-[1.4rem]">
            Primeiros exames
          </h2>
          <Link href="/certificacoes" className="font-semibold text-primary-strong underline-offset-4 hover:underline">
            Domínios, pesos e detalhes
          </Link>
        </div>
        <ul className="grid gap-3.5 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
          {exames.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/certificacoes/${c.slug}`}
                className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-5 hover:border-primary-strong focus-visible:border-primary-strong"
              >
                <span className="tabular font-mono text-sm text-muted-foreground">
                  {c.exame.codigo} · {ROTULO_NIVEL[c.nivel]}
                </span>
                <b className="font-display text-xl font-bold leading-snug">{c.nome}</b>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="como" className="flex flex-col gap-4">
        <h2 id="como" className="text-[1.4rem]">
          Como funciona
        </h2>
        <dl className="grid gap-3.5 sm:grid-cols-3">
          {COMO_FUNCIONA.map((c) => (
            <div key={c.titulo} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
              <dt className="font-display text-lg font-bold">{c.titulo}</dt>
              <dd className="text-muted-foreground">{c.texto}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
