import { log } from "@/lib/log";
import { aplicarPlanoEfetivoCom } from "./plano-efetivo";
import { DIAS_LEMBRETE_PIX } from "./precos";
import { precisaLembretePix } from "./regras";
import type { AssinaturaRepo, EnviarEmailAssinatura } from "./tipos";

export type ResultadoCarencia = { verificados: number; rebaixados: number; promovidos: number; lembretes: number };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Job diário: aplica o downgrade de quem passou da carência ou do fim do acesso
 * Pix e envia o lembrete de renovação do Pix 7 dias antes (uma única vez).
 */
export async function executarCarencia(deps: {
  repo: AssinaturaRepo;
  enviarEmail: EnviarEmailAssinatura;
  agora?: Date;
}): Promise<ResultadoCarencia> {
  const { repo, enviarEmail } = deps;
  const agora = deps.agora ?? new Date();
  const resultado: ResultadoCarencia = { verificados: 0, rebaixados: 0, promovidos: 0, lembretes: 0 };

  for (const userId of await repo.candidatosPlano(agora)) {
    resultado.verificados++;
    const t = await repo.transacao((tx) => aplicarPlanoEfetivoCom(tx, userId, agora));
    if (t.de === "PRO" && t.para === "FREE") {
      resultado.rebaixados++;
      try {
        await enviarEmail({ tipo: "voltou_gratis", userId });
      } catch (e) {
        log("error", "assinatura.email_falhou", { tipo: "voltou_gratis", erro: msg(e) });
      }
    } else if (t.de === "FREE" && t.para === "PRO") {
      resultado.promovidos++;
    }
  }

  const limite = new Date(agora.getTime() + DIAS_LEMBRETE_PIX * 24 * 60 * 60 * 1000);
  for (const sub of await repo.candidatosLembretePix(agora, limite)) {
    if (!sub.accessUntil || !precisaLembretePix(sub, agora)) continue;
    if (await repo.querAvisosPagamento(sub.userId)) {
      try {
        await enviarEmail({ tipo: "lembrete_pix", userId: sub.userId, accessUntil: sub.accessUntil });
        resultado.lembretes++;
      } catch (e) {
        // Não marca: tenta de novo no próximo dia.
        log("error", "assinatura.email_falhou", { tipo: "lembrete_pix", erro: msg(e) });
        continue;
      }
    }
    await repo.salvar(sub.userId, sub.stripeCustomerId, { renewalReminderSentAt: agora });
  }

  return resultado;
}
