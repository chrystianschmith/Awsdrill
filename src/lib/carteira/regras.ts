import { diasEntre, getDayKey } from "@/lib/estudo/tempo";

/*
 * Carteira de certificações: validade e lembretes de recertificação. Funções puras.
 * A validade vem do catálogo (`ExamVersion.validityMonths`, 36 meses na fonte oficial).
 */

/** Lembretes enviados antes do vencimento, em dias; 0 = avisa no dia em que venceu. */
export const ESTAGIOS_LEMBRETE = [180, 90, 30, 7, 0] as const;
export type EstagioLembrete = (typeof ESTAGIOS_LEMBRETE)[number];

/** A partir de quantos dias para vencer a certificação aparece como "vence em breve". */
export const DIAS_VENCE_EM_BREVE = 90;

export type Situacao = "reprovado" | "valida" | "vence_em_breve" | "vencida";

/** examDate (00:00 UTC) + meses, no mesmo dia do mês; dia inexistente vai para o último do mês. */
export function calcularVencimento(examDate: Date, validadeMeses: number): Date {
  const ano = examDate.getUTCFullYear();
  const mes = examDate.getUTCMonth() + validadeMeses;
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(examDate.getUTCDate(), ultimoDia)));
}

/** Dias de hoje (em São Paulo) até o vencimento; negativo se já venceu. */
export function diasParaVencer(expiresAt: Date, agora: Date): number {
  return diasEntre(getDayKey(agora), expiresAt.toISOString().slice(0, 10));
}

export function situacao(c: { result: "PASSED" | "FAILED"; expiresAt: Date | null }, agora: Date): Situacao {
  if (c.result === "FAILED" || !c.expiresAt) return "reprovado";
  const dias = diasParaVencer(c.expiresAt, agora);
  if (dias < 0) return "vencida";
  return dias <= DIAS_VENCE_EM_BREVE ? "vence_em_breve" : "valida";
}

/**
 * Lembrete devido hoje: o estágio mais próximo do vencimento já alcançado, se ainda não foi
 * enviado (estágio menor que o último enviado). Quem cadastra a 20 dias do fim recebe o de 30
 * e depois o de 7, sem receber os de 180 e 90 atrasados. O aviso de vencida sai uma vez, e só
 * até 30 dias depois do vencimento (cadastro de certificação vencida há anos não gera e-mail).
 */
export function lembreteDevido(expiresAt: Date, agora: Date, ultimoEnviado: number | null): EstagioLembrete | null {
  const dias = diasParaVencer(expiresAt, agora);
  if (dias < -30) return null;
  const alcancados = ESTAGIOS_LEMBRETE.filter((e) => dias <= e);
  if (alcancados.length === 0) return null;
  const estagio = alcancados[alcancados.length - 1]!;
  if (ultimoEnviado !== null && estagio >= ultimoEnviado) return null;
  return estagio;
}
