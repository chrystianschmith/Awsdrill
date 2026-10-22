import { getDayKey, diasEntre, inicioDoDiaMais } from "./tempo";

/** Intervalos da revisão espaçada, em dias: passo 0 = +1, 1 = +7, 2 = +30. */
export const INTERVALOS_DIAS = [1, 7, 30] as const;
export const ULTIMO_PASSO = INTERVALOS_DIAS.length - 1;

export type Agendamento = { step: number; dueAt: Date };

/** Data de vencimento: início do dia (São Paulo) `intervalo` dias depois de `agora`. */
export function vencimento(step: number, agora: Date): Date {
  const passo = Math.min(Math.max(0, step), ULTIMO_PASSO);
  return inicioDoDiaMais(agora, INTERVALOS_DIAS[passo]!);
}

/** Concluir um tópico agenda a primeira revisão (+1 dia). */
export function primeiraRevisao(agora: Date): Agendamento {
  return { step: 0, dueAt: vencimento(0, agora) };
}

/**
 * Resultado de uma revisão de tópico: boa avança para o próximo intervalo,
 * difícil volta para +1 dia. Boa no último passo encerra a sequência (null).
 */
export function proximaRevisao(stepAtual: number, boa: boolean, agora: Date): Agendamento | null {
  if (!boa) return { step: 0, dueAt: vencimento(0, agora) };
  const proximo = stepAtual + 1;
  if (proximo > ULTIMO_PASSO) return null;
  return { step: proximo, dueAt: vencimento(proximo, agora) };
}

/** Flashcards usam o mesmo agendador; acertar no último passo mantém +30 dias. */
export function proximoFlashcard(stepAtual: number, acertou: boolean, agora: Date): Agendamento {
  if (!acertou) return { step: 0, dueAt: vencimento(0, agora) };
  const proximo = Math.min(stepAtual + 1, ULTIMO_PASSO);
  return { step: proximo, dueAt: vencimento(proximo, agora) };
}

export function estaVencida(dueAt: Date, agora: Date): boolean {
  return dueAt.getTime() <= agora.getTime();
}

/** Dias de atraso contados em dias de São Paulo (0 = vence hoje). */
export function diasDeAtraso(dueAt: Date, agora: Date): number {
  return Math.max(0, diasEntre(getDayKey(dueAt), getDayKey(agora)));
}

/** Revisões vencidas, da mais atrasada para a mais recente. */
export function ordenarVencidas<T extends { dueAt: Date }>(revisoes: T[], agora: Date): T[] {
  return revisoes.filter((r) => estaVencida(r.dueAt, agora)).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}
