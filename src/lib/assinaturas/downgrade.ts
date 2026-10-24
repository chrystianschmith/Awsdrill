import "server-only";
import { aplicarPlanoEfetivoCom } from "./plano-efetivo";
import { repoPrisma } from "./repo-prisma";
import type { TransicaoPlano } from "./tipos";

/**
 * Aplica o plano efetivo do usuário (pausa exames extras no Grátis, reativa
 * no Pro) e registra a mudança em AuditLog. Idempotente; nunca apaga dados.
 */
export async function aplicarPlanoEfetivo(userId: string, agora: Date = new Date()): Promise<TransicaoPlano> {
  return repoPrisma.transacao((tx) => aplicarPlanoEfetivoCom(tx, userId, agora));
}
