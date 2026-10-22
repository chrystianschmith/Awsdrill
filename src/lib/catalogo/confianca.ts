import type { DiffExame } from "./diff";
import { diffVazio } from "./diff";

/** Abaixo disto a coleta não publica sozinha e vai para a fila de moderação (`pipeline-editais`). */
export const LIMIAR_PUBLICACAO = 0.85;

export type EntradaConfianca = {
  /** Problemas de leitura do guia (montarColetado). */
  problemasLeitura: string[];
  /** Problemas de estrutura (problemasDoBlueprint). */
  problemasBlueprint: string[];
  /** Campos que ficaram sem fonte (camposAConfirmar). */
  camposAConfirmar: string[];
  diff: DiffExame;
};

/**
 * Confiança da coleta, de 0 a 1, calculada pelas regras e não pela palavra de quem extraiu.
 * Remoção de domínio ou de metade das tarefas é rara num exam guide vigente e costuma ser
 * página quebrada; por isso também derruba a confiança.
 */
export function calcularConfianca(e: EntradaConfianca): number {
  let c = 1;
  c -= 0.3 * e.problemasLeitura.length;
  c -= 0.3 * e.problemasBlueprint.length;
  c -= 0.2 * e.camposAConfirmar.length;
  if (e.diff.dominiosRemovidos.length > 0) c -= 0.2;
  if (e.diff.tarefasRemovidas.length >= 3) c -= 0.2;
  return Math.max(0, Math.round(c * 100) / 100);
}

export type Decisao = "SEM_MUDANCA" | "PUBLICAR" | "MODERAR";

export function decidir(diff: DiffExame, confianca: number): Decisao {
  if (diffVazio(diff)) return "SEM_MUDANCA";
  return confianca >= LIMIAR_PUBLICACAO ? "PUBLICAR" : "MODERAR";
}
