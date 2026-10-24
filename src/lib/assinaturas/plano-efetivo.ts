import { resolvePlan } from "./entitlements";
import { planejarSeguidos } from "./regras";
import type { AssinaturaTx, TransicaoPlano } from "./tipos";

/**
 * Aplica o plano efetivo atual do usuário aos dados dele, sem apagar nada:
 * pausa exames extras ao cair para o Grátis e reativa todos ao voltar ao Pro.
 * Registra a mudança de plano em AuditLog. Idempotente.
 */
export async function aplicarPlanoEfetivoCom(tx: AssinaturaTx, userId: string, agora: Date): Promise<TransicaoPlano> {
  const sub = await tx.porUsuario(userId);
  const para = resolvePlan(sub, agora).plan;
  const de = sub?.effectivePlan ?? "FREE";

  const { pausar, reativar } = planejarSeguidos(await tx.seguidos(userId), para);
  if (pausar.length) await tx.definirStatusSeguidos(pausar, "PAUSADO");
  if (reativar.length) await tx.definirStatusSeguidos(reativar, "ATIVO");

  if (sub && de !== para) {
    await tx.salvar(userId, sub.stripeCustomerId, { effectivePlan: para });
    await tx.auditar("assinatura.plano_alterado", userId, {
      de,
      para,
      status: sub.status,
      examesPausados: pausar.length,
      examesReativados: reativar.length,
    });
  }
  return { de, para };
}
