import { createHash } from "node:crypto";
import type { DominioColetado, ExameColetado } from "./schemas";

/** Regras puras do catálogo: validação do blueprint, status dos dados, revisões e Golden Jacket. */

export const NIVEIS = ["FOUNDATIONAL", "ASSOCIATE", "PROFESSIONAL", "SPECIALTY"] as const;
export type Nivel = (typeof NIVEIS)[number];
export type StatusExame = "BETA" | "ACTIVE" | "RETIRING" | "RETIRED";

/** Tolerância da soma dos pesos (a AWS publica inteiros; arredondamento de 2 casas). */
const TOLERANCIA_SOMA = 0.01;

/** Problemas de estrutura do blueprint, em pt-BR. Lista vazia = estrutura coerente. */
export function problemasDoBlueprint(dominios: DominioColetado[]): string[] {
  const problemas: string[] = [];
  const codigos = new Set<string>();
  dominios.forEach((d, i) => {
    if (d.codigo !== String(i + 1)) problemas.push(`Domínio ${d.codigo} fora de ordem (esperado ${i + 1}).`);
    if (codigos.has(d.codigo)) problemas.push(`Domínio ${d.codigo} repetido.`);
    codigos.add(d.codigo);
    if (d.tarefas.length === 0) problemas.push(`Domínio ${d.codigo} sem task statements.`);
    d.tarefas.forEach((t, j) => {
      const esperado = `${d.codigo}.${j + 1}`;
      if (t.codigo !== esperado) problemas.push(`Tarefa ${t.codigo} fora de ordem (esperado ${esperado}).`);
    });
  });
  const pesos = dominios.map((d) => d.peso);
  if (pesos.every((p) => p !== null)) {
    const soma = pesos.reduce<number>((s, p) => s + (p ?? 0), 0);
    if (Math.abs(soma - 100) > TOLERANCIA_SOMA) problemas.push(`Pesos somam ${soma}%, não 100%.`);
  }
  return problemas;
}

/** Campos que precisam de fonte oficial para o exame contar como OFFICIAL. */
export function camposAConfirmar(exame: ExameColetado): string[] {
  const faltando: string[] = [];
  if (exame.totalQuestoes === null) faltando.push("número de questões");
  if (exame.duracaoMin === null) faltando.push("duração");
  if (exame.notaCorte === null) faltando.push("nota de corte");
  if (exame.precoUsd === null) faltando.push("preço");
  for (const d of exame.dominios) if (d.peso === null) faltando.push(`peso do domínio ${d.codigo}`);
  return faltando;
}

export function statusDosDados(exame: ExameColetado): "OFFICIAL" | "A_CONFIRMAR" {
  return camposAConfirmar(exame).length === 0 ? "OFFICIAL" : "A_CONFIRMAR";
}

/** Publica sozinho só o que veio inteiro de fonte oficial e com estrutura coerente; o resto vai para revisão. */
export function estadoDePublicacao(exame: ExameColetado): "PUBLISHED" | "PENDING_REVIEW" {
  return statusDosDados(exame) === "OFFICIAL" && problemasDoBlueprint(exame.dominios).length === 0
    ? "PUBLISHED"
    : "PENDING_REVIEW";
}

/**
 * Hash SHA-256 do blueprint normalizado (códigos, nomes oficiais e pesos).
 * A tradução (nomePt) é nossa e não entra: mudar a tradução não cria revisão.
 */
export function hashBlueprint(dominios: DominioColetado[]): string {
  const normalizado = dominios.map((d) => ({
    c: d.codigo,
    n: d.nomeEn.trim().replace(/\s+/g, " "),
    p: d.peso,
    t: d.tarefas.map((t) => ({ c: t.codigo, n: t.nomeEn.trim().replace(/\s+/g, " ") })),
  }));
  return createHash("sha256").update(JSON.stringify(normalizado)).digest("hex");
}

/** Próxima revisão de pesos: null se o blueprint coletado é igual ao último gravado. */
export function proximaRevisao(ultima: { revision: number; sourceHash: string } | null, hash: string): number | null {
  if (!ultima) return 1;
  return ultima.sourceHash === hash ? null : ultima.revision + 1;
}

/** Versão que ainda conta para a Golden Jacket: ativa ou aposentando, sem data de aposentadoria vencida. */
export function versaoVigente(v: { status: StatusExame; retiresAt: Date | null }, agora: Date): boolean {
  if (v.status !== "ACTIVE" && v.status !== "RETIRING") return false;
  return v.retiresAt === null || v.retiresAt.getTime() > agora.getTime();
}

type CertComVersoes = {
  slug: string;
  level: Nivel;
  trackOrder: number;
  versions: { status: StatusExame; retiresAt: Date | null }[];
};

/** Ordem da trilha: Foundational → Associate → Professional → Specialty, e a ordem sugerida dentro do nível. */
export function ordenarTrilha<T extends { level: Nivel; trackOrder: number; slug: string }>(certs: T[]): T[] {
  return [...certs].sort(
    (a, b) =>
      NIVEIS.indexOf(a.level) - NIVEIS.indexOf(b.level) || a.trackOrder - b.trackOrder || a.slug.localeCompare(b.slug),
  );
}

/**
 * Conjunto exigido para a Golden Jacket em `agora`: certificações com alguma versão vigente.
 * Calculado a partir do catálogo, nunca guardado como flag. Beta não conta.
 */
export function conjuntoGoldenJacket<T extends CertComVersoes>(certs: T[], agora: Date): T[] {
  return ordenarTrilha(certs.filter((c) => c.versions.some((v) => versaoVigente(v, agora))));
}
