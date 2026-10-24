"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { requireAdmin } from "@/lib/auth/session";
import { aprovarRevisao, rejeitarRevisao } from "@/lib/catalogo/moderacao";
import { AppError } from "@/lib/errors";
import { executar } from "@/lib/estudo/acao";
import { moderarQuestoes } from "@/lib/simulados/importacao";

/*
 * Ações do painel admin. Cada uma revalida o papel ADMIN no servidor (a página que mostra o
 * botão não basta) e registra a decisão em AuditLog.
 */

const Id = z.string().min(1).max(64);
const Ids = z.array(Id).min(1).max(50);
const Nota = z.string().trim().min(3, "Escreva o motivo.").max(500);

const ModerarQuestoes = z.discriminatedUnion("aprovar", [
  z.object({ ids: Ids, aprovar: z.literal(true) }).strict(),
  z.object({ ids: Ids, aprovar: z.literal(false), nota: Nota }).strict(),
]);

export async function moderarQuestoesAction(input: z.input<typeof ModerarQuestoes>) {
  const admin = await requireAdmin();
  return executar("admin.questoes", async () => {
    const dados = ModerarQuestoes.parse(input);
    const n = await moderarQuestoes(
      db,
      dados.ids,
      dados.aprovar ? { aprovar: true } : { aprovar: false, nota: dados.nota },
    );
    await audit(dados.aprovar ? "admin.questoes.aprovadas" : "admin.questoes.rejeitadas", admin.id, { total: n });
    revalidatePath("/admin/questoes");
    revalidatePath("/admin");
    return { moderadas: n };
  });
}

export async function resolverReportAction(id: string) {
  const admin = await requireAdmin();
  return executar("admin.report", async () => {
    const r = await db.contentReport.updateMany({
      where: { id: Id.parse(id), resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    if (r.count === 0) throw new AppError("Report não encontrado ou já resolvido.", "nao_encontrado");
    await audit("admin.report.resolvido", admin.id, { reportId: id });
    revalidatePath("/admin/reports");
  });
}

/**
 * Material de uma tarefa depois dos reports: "republicar" mantém o texto atual; "regerar" apaga
 * resumo e flashcards para a próxima visita de um assinante gerar de novo. Os dois resolvem os
 * reports abertos da tarefa.
 */
export async function decidirMaterialAction(input: { topicId: string; decisao: "republicar" | "regerar" }) {
  const admin = await requireAdmin();
  return executar("admin.material", async () => {
    const { topicId, decisao } = z
      .object({ topicId: Id, decisao: z.enum(["republicar", "regerar"]) })
      .strict()
      .parse(input);
    const agora = new Date();
    await db.$transaction([
      decisao === "republicar"
        ? db.summary.updateMany({ where: { topicId }, data: { published: true } })
        : db.summary.deleteMany({ where: { topicId } }),
      decisao === "republicar"
        ? db.flashcard.updateMany({ where: { topicId }, data: { published: true } })
        : db.flashcard.deleteMany({ where: { topicId } }),
      db.contentReport.updateMany({ where: { topicId, resolvedAt: null }, data: { resolvedAt: agora } }),
    ]);
    await audit(`admin.material.${decisao}`, admin.id, { topicId });
    revalidatePath("/admin/reports");
    revalidatePath(`/material/${topicId}`);
  });
}

export async function decidirRevisaoCatalogoAction(input: { id: string; aprovar: boolean }) {
  const admin = await requireAdmin();
  return executar("admin.catalogo", async () => {
    const { id, aprovar } = z.object({ id: Id, aprovar: z.boolean() }).strict().parse(input);
    const atual = await db.catalogReview.findUnique({ where: { id }, select: { status: true, examCode: true } });
    if (!atual) throw new AppError("Revisão não encontrada.", "nao_encontrado");
    if (atual.status !== "PENDING") throw new AppError("Esta revisão já foi decidida.", "conflito");
    if (aprovar) await aprovarRevisao(db, id);
    else await rejeitarRevisao(db, id);
    await audit(aprovar ? "admin.catalogo.aprovado" : "admin.catalogo.rejeitado", admin.id, {
      reviewId: id,
      exame: atual.examCode,
    });
    revalidatePath("/admin/catalogo");
    revalidatePath("/certificacoes");
  });
}
