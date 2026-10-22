import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { listarCertificacoes, type CertificacaoResumo } from "@/lib/catalogo/consultas";
import { NIVEIS } from "@/lib/catalogo/regras";
import { formatarMinutos, formatarUsd, ouAConfirmar, ROTULO_NIVEL, ROTULO_STATUS } from "@/lib/catalogo/rotulos";

export const metadata: Metadata = {
  title: "Certificações",
  description: "Exames de nuvem cobertos, com domínios, pesos, duração e nota de corte das fontes oficiais.",
};

export default async function CertificacoesPage() {
  const certs = await listarCertificacoes();
  const porNivel = NIVEIS.map((nivel) => ({ nivel, certs: certs.filter((c) => c.nivel === nivel) })).filter(
    (g) => g.certs.length > 0,
  );

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-10 px-4 py-10 sm:px-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Certificações</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Os exames que já cobrimos, na ordem sugerida da trilha. Domínios, pesos, duração e nota de corte vêm do exam guide
          e da página oficial de cada exame; o que a fonte não informa aparece como &quot;a confirmar&quot;.
        </p>
      </header>

      {porNivel.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum exame publicado ainda.</p>
      ) : (
        porNivel.map(({ nivel, certs }) => (
          <section key={nivel} aria-labelledby={`nivel-${nivel}`} className="grid gap-3">
            <h2 id={`nivel-${nivel}`} className="text-lg font-semibold">
              {ROTULO_NIVEL[nivel]}
            </h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {certs.map((c) => (
                <LinhaCertificacao key={c.slug} cert={c} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function LinhaCertificacao({ cert }: { cert: CertificacaoResumo }) {
  const e = cert.exame;
  return (
    <li className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
      <div className="grid gap-1">
        <Link href={`/certificacoes/${cert.slug}`} className="w-fit font-medium text-primary underline underline-offset-4">
          {cert.nome}
        </Link>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular">{e.codigo}</span>
          {e.status !== "ACTIVE" ? <Badge variant="warning">{ROTULO_STATUS[e.status]}</Badge> : null}
        </p>
      </div>
      <dl className="tabular grid grid-cols-3 gap-4 text-sm sm:text-right">
        <div>
          <dt className="text-xs text-muted-foreground">Duração</dt>
          <dd>{ouAConfirmar(e.duracaoMin, formatarMinutos)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Corte</dt>
          <dd>{ouAConfirmar(e.notaCorte)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Preço</dt>
          <dd>{ouAConfirmar(e.precoUsd, formatarUsd)}</dd>
        </div>
      </dl>
    </li>
  );
}
