import { TZDate } from "@date-fns/tz";
import { startOfMonth } from "date-fns";
import type { PrismaClient } from "@/generated/prisma/client";
import { configIA } from "./config";

const TZ = "America/Sao_Paulo";
export const ACAO_ALERTA_ORCAMENTO = "ia.orcamento.alerta";

/** Teto mensal de IA atingido: a geração pausa até o próximo mês. */
export class OrcamentoEsgotadoError extends Error {
  constructor(
    readonly gastoUsd: number,
    readonly limiteUsd: number,
  ) {
    super("A geração de novos conteúdos com IA está pausada no momento. O que já foi gerado continua disponível.");
    this.name = "OrcamentoEsgotadoError";
  }
}

/** Início (UTC) do mês corrente em São Paulo e a chave "2026-10". */
export function mesCorrente(agora: Date = new Date()): { inicio: Date; chave: string } {
  const inicio = startOfMonth(new TZDate(agora.getTime(), TZ));
  const chave = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}`;
  return { inicio: new Date(inicio.getTime()), chave };
}

/** Acesso a dados usado pela checagem de orçamento (injetável nos testes). */
export interface FonteOrcamento {
  gastoDesde(inicio: Date): Promise<number>;
  alertaEnviadoDesde(inicio: Date): Promise<boolean>;
  registrarAlerta(mes: string, gastoUsd: number, limiteUsd: number): Promise<void>;
}

export function fonteOrcamentoPrisma(db: Pick<PrismaClient, "aiUsageLog" | "auditLog">): FonteOrcamento {
  return {
    async gastoDesde(inicio) {
      const r = await db.aiUsageLog.aggregate({ where: { createdAt: { gte: inicio } }, _sum: { costUsd: true } });
      return Number(r._sum.costUsd ?? 0);
    },
    async alertaEnviadoDesde(inicio) {
      const a = await db.auditLog.findFirst({
        where: { action: ACAO_ALERTA_ORCAMENTO, createdAt: { gte: inicio } },
        select: { id: true },
      });
      return a !== null;
    },
    async registrarAlerta(mes, gastoUsd, limiteUsd) {
      await db.auditLog.create({
        data: { action: ACAO_ALERTA_ORCAMENTO, userId: null, metadata: { mes, gastoUsd, limiteUsd } },
      });
    },
  };
}

/** Envia o alerta ao admin (implementação diferente no app e no pipeline). */
export type EnviarAlertaOrcamento = (dados: {
  para: string;
  mes: string;
  gastoUsd: number;
  limiteUsd: number;
}) => Promise<void>;

export type SituacaoOrcamento = { mes: string; gastoUsd: number; limiteUsd: number; restanteUsd: number };

/**
 * Soma o custo de IA do mês (AiUsageLog). Se atingiu AI_MONTHLY_BUDGET_USD,
 * envia um alerta ao ADMIN_ALERT_EMAIL (uma vez por mês) e lança
 * OrcamentoEsgotadoError. Chame antes de qualquer chamada à IA.
 */
export async function verificarOrcamento(opcoes: {
  fonte: FonteOrcamento;
  enviarAlerta?: EnviarAlertaOrcamento;
  limiteUsd?: number;
  emailAlerta?: string | null;
  agora?: Date;
}): Promise<SituacaoOrcamento> {
  const cfg = configIA();
  const limiteUsd = opcoes.limiteUsd ?? cfg.orcamentoMensalUsd;
  const emailAlerta = opcoes.emailAlerta === undefined ? cfg.emailAlerta : opcoes.emailAlerta;
  const { inicio, chave } = mesCorrente(opcoes.agora);
  const gastoUsd = await opcoes.fonte.gastoDesde(inicio);

  if (gastoUsd >= limiteUsd) {
    if (!(await opcoes.fonte.alertaEnviadoDesde(inicio))) {
      // Registra antes de enviar: evita alerta duplicado se duas execuções correrem juntas.
      await opcoes.fonte.registrarAlerta(chave, gastoUsd, limiteUsd);
      if (emailAlerta && opcoes.enviarAlerta) {
        try {
          await opcoes.enviarAlerta({ para: emailAlerta, mes: chave, gastoUsd, limiteUsd });
        } catch {
          // Falha no e-mail não deve liberar a geração.
        }
      }
    }
    throw new OrcamentoEsgotadoError(gastoUsd, limiteUsd);
  }
  return { mes: chave, gastoUsd, limiteUsd, restanteUsd: limiteUsd - gastoUsd };
}
