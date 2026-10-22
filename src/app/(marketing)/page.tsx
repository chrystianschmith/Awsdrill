import type { Metadata } from "next";
import { RegistrarSW } from "@/components/app/registrar-sw";
import { SkipLink } from "@/components/app/skip-link";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Logo } from "@/components/brand/logo";
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

export default function Inicio() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <RegistrarSW />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 outline-none sm:py-16">
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
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. Não somos afiliados à Amazon Web Services; nomes de serviços e exames são
            citados apenas como referência. Prontidão é uma estimativa, não garantia de aprovação.
          </p>
        </div>
      </footer>
    </div>
  );
}
