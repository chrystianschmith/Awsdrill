import type { Nivel, StatusExame } from "./regras";

export const ROTULO_NIVEL: Record<Nivel, string> = {
  FOUNDATIONAL: "Foundational",
  ASSOCIATE: "Associate",
  PROFESSIONAL: "Professional",
  SPECIALTY: "Specialty",
};

export const ROTULO_STATUS: Record<StatusExame, string> = {
  BETA: "Beta",
  ACTIVE: "Ativo",
  RETIRING: "Será aposentado",
  RETIRED: "Aposentado",
};

const usd = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Valor do catálogo ou "a confirmar" quando a fonte oficial não trouxe o dado. */
export function ouAConfirmar<T>(valor: T | null, formatar: (v: T) => string = String): string {
  return valor === null ? "a confirmar" : formatar(valor);
}

export const formatarUsd = (v: number) => usd.format(v);
export const formatarMinutos = (v: number) => `${v} min`;
