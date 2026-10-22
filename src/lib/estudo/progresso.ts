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
 * Progresso do exame (0–100) ponderado pelo peso de cada domínio no blueprint vigente.
 * Domínio com peso "a confirmar" entra com a média dos pesos conhecidos (ou 1, se nenhum é
 * conhecido); domínio sem task statements fica de fora.
 */
export function progressoExame(dominios: { peso: number | null; concluidos: number; total: number }[]): number {
  const comTarefas = dominios.filter((d) => d.total > 0);
  const conhecidos = comTarefas.map((d) => d.peso).filter((p): p is number => p !== null && p > 0);
  const padrao = conhecidos.length > 0 ? conhecidos.reduce((a, b) => a + b, 0) / conhecidos.length : 1;
  let soma = 0;
  let pesos = 0;
  for (const d of comTarefas) {
    const w = d.peso !== null && d.peso > 0 ? d.peso : padrao;
    soma += w * (d.concluidos / d.total);
    pesos += w;
  }
  return pesos === 0 ? 0 : Math.round((soma / pesos) * 100);
}
