import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { certificacoesParaEscolher, listarCarteira } from "@/lib/carteira/servico";
import type { Situacao } from "@/lib/carteira/regras";
import { getDayKey } from "@/lib/estudo/tempo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CabecalhoPagina } from "@/components/estudo/basicos";
import { ExcluirCertificacao, FormCertificacao } from "@/components/carteira/form-certificacao";

export const metadata: Metadata = { title: "Carteira" };

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

const SITUACAO: Record<Situacao, { rotulo: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  valida: { rotulo: "Válida", variant: "success" },
  vence_em_breve: { rotulo: "Vence em breve", variant: "warning" },
  vencida: { rotulo: "Vencida", variant: "danger" },
  reprovado: { rotulo: "Reprovado", variant: "neutral" },
};

/** Certificações que a pessoa já fez, com validade e lembrete de recertificação. */
export default async function CarteiraPage() {
  const user = await requireUser();
  const agora = new Date();
  const [itens, opcoes] = await Promise.all([listarCarteira(user.id, agora), certificacoesParaEscolher()]);
  const hoje = getDayKey(agora);
  const validas = itens.filter((i) => i.situacao === "valida" || i.situacao === "vence_em_breve").length;

  return (
    <div className="grid gap-6">
      <CabecalhoPagina
        titulo="Carteira"
        descricao="Suas certificações, com a validade de cada uma. Avisamos por e-mail 180, 90, 30 e 7 dias antes de vencer."
        acoes={<FormCertificacao opcoes={opcoes} hoje={hoje} />}
      />
      {itens.length === 0 ? (
        <EmptyState
          title="Nenhuma certificação na carteira"
          description="Adicione as certificações que você já fez para acompanhar a validade e receber o lembrete de recertificação."
        />
      ) : (
        <>
          <p className="tabular text-sm text-muted-foreground">
            {validas} {validas === 1 ? "certificação válida" : "certificações válidas"}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {itens.map((i) => {
              const s = SITUACAO[i.situacao];
              const registro = { id: i.id, nome: i.certification.name };
              return (
                <li key={i.id}>
                  <Card className="h-full">
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <CardTitle className="text-base">{i.certification.name}</CardTitle>
                        <Badge variant={s.variant}>{s.rotulo}</Badge>
                      </div>
                      <CardDescription className="tabular">
                        {i.examCode ? `${i.examCode} · ` : ""}feito em {fmt.format(i.examDate)}
                        {i.scaledScore ? ` · nota ${i.scaledScore}` : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm">
                      {i.expiresAt && i.diasParaVencer !== null ? (
                        <p className="tabular">
                          {i.diasParaVencer < 0 ? "Venceu em " : "Válida até "}
                          {fmt.format(i.expiresAt)}
                          {i.diasParaVencer >= 0 ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {i.diasParaVencer} {i.diasParaVencer === 1 ? "dia" : "dias"}
                            </span>
                          ) : null}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">Sem validade: o exame não foi aprovado.</p>
                      )}
                      {i.badgeUrl ? (
                        <a
                          href={i.badgeUrl}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="w-fit text-primary-strong underline underline-offset-4"
                        >
                          Ver badge
                        </a>
                      ) : null}
                      <div className="flex flex-wrap gap-1">
                        <FormCertificacao
                          opcoes={opcoes}
                          hoje={hoje}
                          registro={registro}
                          inicial={{
                            certificationId: i.certificationId,
                            examCode: i.examCode ?? "",
                            result: i.result,
                            examDate: i.examDate.toISOString().slice(0, 10),
                            scaledScore: i.scaledScore ? String(i.scaledScore) : "",
                            badgeUrl: i.badgeUrl ?? "",
                          }}
                        />
                        <ExcluirCertificacao registro={registro} />
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Os dados são informados por você e não são verificados com a AWS. Para renovar, veja as{" "}
        <Link
          href="https://aws.amazon.com/certification/recertification/"
          className="text-primary-strong underline underline-offset-4"
          target="_blank"
          rel="noopener noreferrer"
        >
          regras de recertificação oficiais
        </Link>
        .
      </p>
    </div>
  );
}
