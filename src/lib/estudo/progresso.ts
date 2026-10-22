export const STATUS_TOPICO = ["NAO_INICIADO", "ESTUDANDO", "CONCLUIDO", "REVISAR"] as const;
export type StatusTopico = (typeof STATUS_TOPICO)[number];

export const ROTULO_STATUS: Record<StatusTopico, string> = {
  NAO_INICIADO: "Não iniciado",
  ESTUDANDO: "Estudando",
  CONCLUIDO: "Concluído",
  REVISAR: "Revisar",
};

/** Tarefa em "Revisar" já foi concluída uma vez; conta como concluída no progresso. */
export function contaComoConcluido(status: StatusTopico): boolean {
  return status === "CONCLUIDO" || status === "REVISAR";
}

/** Status ao registrar estudo numa tarefa: só sai de "não iniciado". */
export function statusAoEstudar(atual: StatusTopico): StatusTopico {
  return atual === "NAO_INICIADO" ? "ESTUDANDO" : atual;
}

export type Progresso = { concluidos: number; total: number; pct: number };

/** Progresso de um domínio: task statements concluídas / total. */
export function progressoDominio(statuses: StatusTopico[]): Progresso {
  const total = statuses.length;
  const concluidos = statuses.filter(contaComoConcluido).length;
  return { concluidos, total, pct: total === 0 ? 0 : Math.round((concluidos / total) * 100) };
}

/**
 * Peso efetivo de cada domínio, na mesma ordem: peso "a confirmar" (null ou 0) entra com a
 * média dos pesos conhecidos, ou 1 se nenhum é conhecido.
 */
export function pesosEfetivos(pesos: (number | null)[]): number[] {
  const conhecidos = pesos.filter((p): p is number => p !== null && p > 0);
  const padrao = conhecidos.length > 0 ? conhecidos.reduce((a, b) => a + b, 0) / conhecidos.length : 1;
  return pesos.map((p) => (p !== null && p > 0 ? p : padrao));
}

/**
 * Progresso do exame (0–100) ponderado pelo peso de cada domínio no blueprint vigente
 * (ver pesosEfetivos); domínio sem task statements fica de fora.
 */
export function progressoExame(dominios: { peso: number | null; concluidos: number; total: number }[]): number {
  const comTarefas = dominios.filter((d) => d.total > 0);
  const pesos = pesosEfetivos(comTarefas.map((d) => d.peso));
  let soma = 0;
  let total = 0;
  comTarefas.forEach((d, i) => {
    soma += pesos[i]! * (d.concluidos / d.total);
    total += pesos[i]!;
  });
  return total === 0 ? 0 : Math.round((soma / total) * 100);
}
