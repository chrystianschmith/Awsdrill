import type { ExameColetado } from "./schemas";

/** Diferença entre o exame gravado e o coletado. A tradução (nomePt) e a data de leitura não contam. */
export type DiffExame = {
  fatos: { campo: CampoFato; de: number | string | null; para: number | string | null }[];
  dominiosIncluidos: { codigo: string; nomeEn: string }[];
  dominiosRemovidos: { codigo: string; nomeEn: string }[];
  dominiosRenomeados: { codigo: string; de: string; para: string }[];
  pesos: { codigo: string; de: number | null; para: number | null }[];
  tarefasIncluidas: { codigo: string; nomeEn: string }[];
  tarefasRemovidas: { codigo: string; nomeEn: string }[];
  tarefasRenomeadas: { codigo: string; de: string; para: string }[];
};

const FATOS = [
  "status",
  "totalQuestoes",
  "questoesPontuadas",
  "duracaoMin",
  "notaCorte",
  "precoUsd",
  "lancadoEm",
  "aposentaEm",
  "fonteGuia",
  "fontePagina",
] as const;
type CampoFato = (typeof FATOS)[number];

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ");

function porCodigo<T extends { codigo: string; nomeEn: string }>(antes: T[], depois: T[]) {
  const a = new Map(antes.map((x) => [x.codigo, x]));
  const d = new Map(depois.map((x) => [x.codigo, x]));
  return {
    incluidos: depois.filter((x) => !a.has(x.codigo)).map(({ codigo, nomeEn }) => ({ codigo, nomeEn })),
    removidos: antes.filter((x) => !d.has(x.codigo)).map(({ codigo, nomeEn }) => ({ codigo, nomeEn })),
    renomeados: depois.flatMap((x) => {
      const ant = a.get(x.codigo);
      return ant && normalizar(ant.nomeEn) !== normalizar(x.nomeEn) ? [{ codigo: x.codigo, de: ant.nomeEn, para: x.nomeEn }] : [];
    }),
    comuns: depois.flatMap((x) => {
      const ant = a.get(x.codigo);
      return ant ? [{ antes: ant, depois: x }] : [];
    }),
  };
}

export function diffExame(antes: ExameColetado, depois: ExameColetado): DiffExame {
  const fatos = FATOS.flatMap((campo) =>
    antes[campo] === depois[campo] ? [] : [{ campo, de: antes[campo], para: depois[campo] }],
  );
  const dom = porCodigo(antes.dominios, depois.dominios);
  const tar = porCodigo(
    antes.dominios.flatMap((d) => d.tarefas),
    depois.dominios.flatMap((d) => d.tarefas),
  );
  return {
    fatos,
    dominiosIncluidos: dom.incluidos,
    dominiosRemovidos: dom.removidos,
    dominiosRenomeados: dom.renomeados,
    pesos: dom.comuns.flatMap(({ antes: a, depois: d }) =>
      a.peso === d.peso ? [] : [{ codigo: d.codigo, de: a.peso, para: d.peso }],
    ),
    tarefasIncluidas: tar.incluidos,
    tarefasRemovidas: tar.removidos,
    tarefasRenomeadas: tar.renomeados,
  };
}

export function diffVazio(d: DiffExame): boolean {
  return Object.values(d).every((lista) => lista.length === 0);
}
