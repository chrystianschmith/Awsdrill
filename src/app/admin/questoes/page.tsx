import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { Alternativas } from "@/lib/simulados/schemas";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ModerarQuestao } from "../_components/moderar-questao";
import { Cabecalho, Paginacao } from "../_components/ui";
import { fmtDataHora, paginaDe } from "../_lib/formato";

export const metadata = { title: "Questões · Admin" };

const POR_PAGINA = 20;

/** Fila de questões pendentes (importadas ou geradas por IA): só publicadas entram nos simulados. */
export default async function QuestoesPendentes({ searchParams }: PageProps<"/admin/questoes">) {
  await requireAdmin();
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const exame = typeof sp.exame === "string" ? sp.exame : undefined;

  const [porExame, questoes] = await Promise.all([
    db.question.groupBy({
      by: ["examVersionId"],
      where: { publishState: "PENDING_REVIEW" },
      _count: { _all: true },
    }),
    db.question.findMany({
      where: { publishState: "PENDING_REVIEW", ...(exame ? { examVersion: { code: exame } } : {}) },
      orderBy: [{ importedAt: "asc" }, { id: "asc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA + 1,
      select: {
        id: true,
        type: true,
        stem: true,
        options: true,
        correctKeys: true,
        explanation: true,
        docUrls: true,
        origin: true,
        promptVersion: true,
        importedAt: true,
        examVersion: { select: { code: true } },
        domain: { select: { code: true, namePt: true, nameEn: true } },
        topic: { select: { code: true } },
      },
    }),
  ]);
  const codigos = await db.examVersion.findMany({
    where: { id: { in: porExame.map((p) => p.examVersionId) } },
    select: { id: true, code: true },
  });
  const contagem = porExame
    .map((p) => ({ codigo: codigos.find((c) => c.id === p.examVersionId)?.code ?? "?", n: p._count._all }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const temMais = questoes.length > POR_PAGINA;
  const pagina_ = questoes.slice(0, POR_PAGINA);

  return (
    <>
      <Cabecalho
        titulo="Questões pendentes"
        descricao="Confira enunciado, gabarito, explicação e links oficiais antes de aprovar. Rejeitadas nunca vão aos simulados."
        acoes={pagina_.length > 1 ? <ModerarQuestao ids={pagina_.map((q) => q.id)} rotulo="página" /> : null}
      />
      {contagem.length > 0 ? (
        <nav aria-label="Filtrar por exame" className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/admin/questoes"
            aria-current={!exame ? "page" : undefined}
            className={cn("rounded-md px-2 py-1", !exame ? "bg-surface-muted font-medium" : "text-muted-foreground")}
          >
            Todas ({contagem.reduce((s, c) => s + c.n, 0)})
          </Link>
          {contagem.map((c) => (
            <Link
              key={c.codigo}
              href={`/admin/questoes?exame=${c.codigo}`}
              aria-current={exame === c.codigo ? "page" : undefined}
              className={cn(
                "rounded-md px-2 py-1",
                exame === c.codigo ? "bg-surface-muted font-medium" : "text-muted-foreground",
              )}
            >
              {c.codigo} ({c.n})
            </Link>
          ))}
        </nav>
      ) : null}
      {pagina_.length === 0 ? (
        <EmptyState
          title="Nenhuma questão pendente"
          description="Questões importadas pela CLI ou geradas com o material de IA aparecem aqui para revisão."
        />
      ) : (
        <ol className="grid gap-4">
          {pagina_.map((q, n) => {
            const opcoes = Alternativas.safeParse(q.options);
            const rotulo = `questão ${(pagina - 1) * POR_PAGINA + n + 1}`;
            return (
              <li key={q.id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">
                        {q.examVersion.code} · {q.topic?.code ?? q.domain.code}
                      </CardTitle>
                      <Badge>{q.type === "MULTIPLE" ? "Escolha 2" : "Escolha 1"}</Badge>
                      <Badge variant={q.origin === "ia" ? "primary" : "neutral"}>
                        {q.origin === "ia" ? `IA ${q.promptVersion ?? ""}` : "Autoral"}
                      </Badge>
                    </div>
                    <CardDescription>
                      {q.domain.namePt ?? q.domain.nameEn} · importada em {fmtDataHora(q.importedAt)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm">
                    <p className="whitespace-pre-line">{q.stem}</p>
                    {opcoes.success ? (
                      <ul className="grid gap-1">
                        {opcoes.data.map((o) => {
                          const certa = q.correctKeys.includes(o.key);
                          return (
                            <li
                              key={o.key}
                              className={cn("rounded-md px-2 py-1", certa ? "bg-success/15" : "bg-surface-muted")}
                            >
                              <span className="font-medium">{o.key}.</span> {o.text}
                              {certa ? <span className="sr-only"> (correta)</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-danger">Alternativas fora do formato: rejeite e reimporte.</p>
                    )}
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Gabarito {q.correctKeys.join(", ")}.</span>{" "}
                      {q.explanation}
                    </p>
                    <ul className="grid gap-0.5">
                      {q.docUrls.map((u) => (
                        <li key={u}>
                          <a
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-primary-strong underline underline-offset-4"
                          >
                            {u}
                          </a>
                        </li>
                      ))}
                    </ul>
                    <ModerarQuestao ids={[q.id]} rotulo={rotulo} />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
      <Paginacao pagina={pagina} temMais={temMais} base="/admin/questoes" params={exame ? { exame } : {}} />
    </>
  );
}
