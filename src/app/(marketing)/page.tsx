import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} · certificações de nuvem` },
  description: BRAND.tagline,
};

// Primeira fase do catálogo. Os dados de cada exame (domínios, pesos, corte) vêm do banco na etapa 3.
const PRIMEIROS_EXAMES = [
  { codigo: "CLF-C02", nome: "Cloud Practitioner", nivel: "Foundational" },
  { codigo: "AIF-C01", nome: "AI Practitioner", nivel: "Foundational" },
  { codigo: "SAA-C03", nome: "Solutions Architect – Associate", nivel: "Associate" },
];

const COMO_FUNCIONA = [
  { titulo: "Plano pelo blueprint", texto: "Estudo distribuído pelos domínios e pesos do guia oficial de cada exame." },
  { titulo: "Simulados por domínio", texto: "Modo treino com explicação e link para a documentação; modo prova com tempo real." },
  { titulo: "Prontidão medida", texto: "Uma estimativa por domínio, com metodologia publicada, antes de você marcar a prova." },
];

export default async function Inicio({ searchParams }: PageProps<"/">) {
  const contaExcluida = (await searchParams).conta === "excluida";
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
      {contaExcluida ? (
        <Alert tone="success" role="status" className="mb-8">
          Sua conta foi excluída e seus dados pessoais foram apagados.
        </Alert>
      ) : null}
      <p className="text-sm font-medium text-muted-foreground">Em construção</p>
      <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Do primeiro exame de nuvem até a recertificação, com plano e prontidão medida
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground">{BRAND.tagline}</p>

      <section aria-labelledby="exames" className="mt-12">
        <h2 id="exames" className="text-lg font-semibold">
          Primeiros exames
        </h2>
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
          {PRIMEIROS_EXAMES.map((e) => (
            <li key={e.codigo} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <span className="font-medium">{e.nome}</span>
              <span className="tabular text-sm text-muted-foreground">
                {e.codigo} · {e.nivel}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="como" className="mt-12">
        <h2 id="como" className="text-lg font-semibold">
          Como vai funcionar
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
