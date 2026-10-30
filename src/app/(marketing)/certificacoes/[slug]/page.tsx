import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { certificacaoPorSlug } from "@/lib/catalogo/consultas";
import { formatarMinutos, formatarUsd, ouAConfirmar, ROTULO_NIVEL, ROTULO_STATUS } from "@/lib/catalogo/rotulos";

const dataBR = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });

export async function generateMetadata({ params }: PageProps<"/certificacoes/[slug]">): Promise<Metadata> {
  const cert = await certificacaoPorSlug((await params).slug);
  if (!cert) return { title: "Certificação não encontrada" };
  return {
    title: `${cert.exame.codigo} · ${cert.nome}`,
    description: `Domínios, pesos, duração e nota de corte do exame ${cert.exame.codigo}, com fonte oficial.`,
  };
}

export default async function CertificacaoPage({ params }: PageProps<"/certificacoes/[slug]">) {
  const cert = await certificacaoPorSlug((await params).slug);
  if (!cert) notFound();
  const e = cert.exame;

  const fatos = [
    { rotulo: "Nível", valor: ROTULO_NIVEL[cert.nivel] },
    {
      rotulo: "Questões",
      valor:
        e.totalQuestoes === null
          ? "a confirmar"
          : `${e.totalQuestoes}${cert.questoesPontuadas ? ` (${cert.questoesPontuadas} pontuadas)` : ""}`,
    },
    { rotulo: "Duração", valor: ouAConfirmar(e.duracaoMin, formatarMinutos) },
    { rotulo: "Nota de corte", valor: e.notaCorte === null ? "a confirmar" : `${e.notaCorte} de 1000` },
    { rotulo: "Preço da prova", valor: ouAConfirmar(e.precoUsd, formatarUsd) },
    { rotulo: "Validade", valor: `${cert.validadeMeses / 12} anos` },
  ];

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-10 px-4 py-10 sm:px-6">
      <header className="grid gap-3">
        <Link href="/certificacoes" className="w-fit text-sm text-primary-strong underline underline-offset-4">
          Todas as certificações
        </Link>
        <div className="grid gap-1">
          <p className="tabular flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {e.codigo}
            <Badge variant={e.status === "ACTIVE" ? "success" : "warning"}>{ROTULO_STATUS[e.status]}</Badge>
            {e.aConfirmar ? <Badge variant="warning">Dados a confirmar</Badge> : null}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-balance">{cert.nome}</h1>
        </div>
        {cert.aposentaEm ? (
          <p className="text-sm text-muted-foreground">
            Esta versão do exame será aposentada em {dataBR.format(cert.aposentaEm)}.
          </p>
        ) : null}
        <Link href="/exames" className={buttonVariants({ className: "w-fit" })}>
          Estudar este exame
        </Link>
      </header>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3">
        {fatos.map((f) => (
          <div key={f.rotulo}>
            <dt className="text-xs text-muted-foreground">{f.rotulo}</dt>
            <dd className="tabular mt-0.5 font-medium">{f.valor}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="dominios" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="dominios" className="text-lg font-semibold">
            Domínios e pesos
          </h2>
          <p className="text-sm text-muted-foreground">
            Percentual do conteúdo pontuado. Nomes oficiais em inglês, com tradução nossa abaixo.
          </p>
        </div>
        <ol className="grid gap-4">
          {cert.dominios.map((d) => (
            <li key={d.codigo} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-medium">
                  <span className="tabular text-muted-foreground">{d.codigo}.</span> {d.nomeEn}
                </h3>
                <span className="tabular shrink-0 font-semibold">{ouAConfirmar(d.peso, (p) => `${p}%`)}</span>
              </div>
              {d.nomePt ? <p className="text-sm text-muted-foreground">{d.nomePt}</p> : null}
              {d.peso !== null ? (
                <div aria-hidden className="mt-3 h-1.5 rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-primary-strong" style={{ width: `${d.peso}%` }} />
                </div>
              ) : null}
              <ul className="mt-3 grid gap-2 text-sm">
                {d.tarefas.map((t) => (
                  <li key={t.codigo} className="grid grid-cols-[2.5rem_1fr] gap-2">
                    <span className="tabular text-muted-foreground">{t.codigo}</span>
                    <span>
                      {t.nomeEn}
                      {t.nomePt ? <span className="block text-muted-foreground">{t.nomePt}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="fontes" className="grid gap-2 text-sm">
        <h2 id="fontes" className="text-lg font-semibold">
          Fontes
        </h2>
        <ul className="grid list-disc gap-1 pl-5">
          <li>
            <a
              href={cert.fonteGuia}
              className="text-primary-strong underline underline-offset-4"
              rel="noopener noreferrer"
              target="_blank"
            >
              Exam guide oficial
            </a>
            {cert.revisao ? <span className="text-muted-foreground"> (revisão {cert.revisao} dos pesos)</span> : null}
          </li>
          {cert.fontePagina ? (
            <li>
              <a
                href={cert.fontePagina}
                className="text-primary-strong underline underline-offset-4"
                rel="noopener noreferrer"
                target="_blank"
              >
                Página oficial da certificação
              </a>
            </li>
          ) : null}
        </ul>
        <p className="text-muted-foreground">
          Lido em {dataBR.format(cert.lidoEm)}. Em caso de diferença, vale a fonte oficial. Não somos afiliados à Amazon
          Web Services.
        </p>
      </section>
    </div>
  );
}
