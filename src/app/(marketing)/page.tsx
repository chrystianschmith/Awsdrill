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

export default async function Inicio({ searchParams }: PageProps<"/">) {
  const contaExcluida = (await searchParams).conta === "excluida";
  const [exames, user] = await Promise.all([listarCertificacoes(), getCurrentUser()]);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
      {contaExcluida ? (
        <Alert tone="success" role="status" className="mb-8">
          Sua conta foi excluída e seus dados pessoais foram apagados.
        </Alert>
      ) : null}
      <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Do primeiro exame de nuvem até a recertificação, com plano e prontidão medida
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground">{BRAND.tagline}</p>
      <div className="mt-6 flex flex-wrap gap-3">
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

      <section aria-labelledby="exames" className="mt-12">
        <h2 id="exames" className="text-lg font-semibold">
          Primeiros exames
        </h2>
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
          {exames.map((c) => (
            <li key={c.slug} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <Link href={`/certificacoes/${c.slug}`} className="font-medium text-primary underline underline-offset-4">
                {c.nome}
              </Link>
              <span className="tabular text-sm text-muted-foreground">
                {c.exame.codigo} · {ROTULO_NIVEL[c.nivel]}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/certificacoes" className="mt-3 inline-block text-sm text-primary underline underline-offset-4">
          Ver domínios, pesos e detalhes de cada exame
        </Link>
      </section>

      <section aria-labelledby="como" className="mt-12">
        <h2 id="como" className="text-lg font-semibold">
          Como funciona
        </h2>
        <dl className="mt-4 grid gap-6 sm:grid-cols-3">
          {COMO_FUNCIONA.map((c) => (
            <div key={c.titulo}>
              <dt className="font-medium">{c.titulo}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{c.texto}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
