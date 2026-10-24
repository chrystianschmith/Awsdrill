import { NextResponse } from "next/server";
import { limparRateLimit } from "@/lib/auth/rate-limit";
import { executarCarencia } from "@/lib/assinaturas/carencia";
import { enviarEmailAssinatura } from "@/lib/assinaturas/emails";
import { repoPrisma } from "@/lib/assinaturas/repo-prisma";
import { cronAutorizado } from "@/lib/cron";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Diário (o Vercel Hobby só tem cron diário, então um job faz tudo): downgrade de quem passou da
 * carência ou do fim do acesso Pix, lembrete de renovação do Pix, e limpeza de sessões expiradas,
 * tokens usados ou vencidos e janelas antigas de rate limit.
 */
export async function GET(request: Request) {
  if (!cronAutorizado(request)) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  const agora = new Date();
  const tokensVencidos = { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: agora } }] };
  const [sessoes, verificacao, reset] = await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: agora } } }),
    db.emailVerificationToken.deleteMany({ where: tokensVencidos }),
    db.passwordResetToken.deleteMany({ where: tokensVencidos }),
  ]);
  const rateLimit = await limparRateLimit();
  const carencia = await executarCarencia({ repo: repoPrisma, enviarEmail: enviarEmailAssinatura, agora });
  const resultado = {
    sessoes: sessoes.count,
    tokensVerificacao: verificacao.count,
    tokensReset: reset.count,
    rateLimit,
    carencia,
  };
  log("info", "cron.limpeza", resultado);
  return NextResponse.json(resultado);
}
