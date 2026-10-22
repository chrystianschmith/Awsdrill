import { describe, expect, it } from "vitest";
import { calcularConfianca, decidir, LIMIAR_PUBLICACAO } from "@/lib/catalogo/confianca";
import { diffExame, diffVazio } from "@/lib/catalogo/diff";
import type { ExameColetado } from "@/lib/catalogo/schemas";
import { EXAMES_INICIAIS } from "../../../prisma/catalogo/exames";

const base = () => structuredClone(EXAMES_INICIAIS[0]) as ExameColetado;

describe("diffExame", () => {
  it("ignora data de leitura e tradução", () => {
    const depois = base();
    depois.lidoEm = "2026-12-01";
    depois.dominios[0]!.nomePt = "outra tradução";
    depois.dominios[0]!.tarefas[0]!.nomePt = null;
    expect(diffVazio(diffExame(base(), depois))).toBe(true);
  });

  it("aponta fatos, pesos, domínios e tarefas incluídos, removidos e renomeados", () => {
    const depois = base();
    depois.notaCorte = 720;
    depois.dominios[0]!.peso = 20;
    depois.dominios[1]!.peso = 34;
    depois.dominios[2]!.nomeEn = "Cloud Technology";
    depois.dominios[0]!.tarefas.pop(); // remove 1.4
    depois.dominios[1]!.tarefas.push({ codigo: "2.5", nomeEn: "Nova tarefa oficial", nomePt: null });
    depois.dominios[3]!.tarefas[0]!.nomeEn = "Renamed task";
    depois.dominios.push({ codigo: "5", nomeEn: "New Domain", nomePt: null, peso: 0, tarefas: [] });

    const d = diffExame(base(), depois);
    expect(d.fatos).toEqual([{ campo: "notaCorte", de: 700, para: 720 }]);
    expect(d.pesos).toEqual([
      { codigo: "1", de: 24, para: 20 },
      { codigo: "2", de: 30, para: 34 },
    ]);
    expect(d.dominiosIncluidos).toEqual([{ codigo: "5", nomeEn: "New Domain" }]);
    expect(d.dominiosRemovidos).toEqual([]);
    expect(d.dominiosRenomeados).toEqual([{ codigo: "3", de: "Cloud Technology and Services", para: "Cloud Technology" }]);
    expect(d.tarefasIncluidas).toEqual([{ codigo: "2.5", nomeEn: "Nova tarefa oficial" }]);
    expect(d.tarefasRemovidas.map((t) => t.codigo)).toEqual(["1.4"]);
    expect(d.tarefasRenomeadas.map((t) => t.codigo)).toEqual(["4.1"]);
    expect(diffVazio(d)).toBe(false);
  });

  it("aponta domínio removido", () => {
    const depois = base();
    depois.dominios.pop();
    expect(diffExame(base(), depois).dominiosRemovidos).toEqual([{ codigo: "4", nomeEn: "Billing, Pricing, and Support" }]);
  });
});

describe("calcularConfianca e decidir", () => {
  const vazio = diffExame(base(), base());
  const comPeso = (() => {
    const d = base();
    d.dominios[0]!.peso = 20;
    d.dominios[1]!.peso = 34;
    return diffExame(base(), d);
  })();
  const limpo = { problemasLeitura: [], problemasBlueprint: [], camposAConfirmar: [] };

  it("coleta limpa tem confiança 1 e publica a mudança sozinha", () => {
    const c = calcularConfianca({ ...limpo, diff: comPeso });
    expect(c).toBe(1);
    expect(decidir(comPeso, c)).toBe("PUBLICAR");
  });

  it("sem mudança não publica nem modera, qualquer que seja a confiança", () => {
    expect(decidir(vazio, 0)).toBe("SEM_MUDANCA");
  });

  it("um problema de leitura ou de estrutura já manda para a moderação", () => {
    for (const extra of [{ problemasLeitura: ["x"] }, { problemasBlueprint: ["x"] }, { camposAConfirmar: ["preço"] }]) {
      const c = calcularConfianca({ ...limpo, ...extra, diff: comPeso });
      expect(c).toBeLessThan(LIMIAR_PUBLICACAO);
      expect(decidir(comPeso, c)).toBe("MODERAR");
    }
  });

  it("remoção de domínio ou de 3+ tarefas derruba a confiança", () => {
    const semDominio = base();
    semDominio.dominios.pop();
    const semTarefas = base();
    semTarefas.dominios[2]!.tarefas.splice(0, 3);
    expect(calcularConfianca({ ...limpo, diff: diffExame(base(), semDominio) })).toBeLessThan(LIMIAR_PUBLICACAO);
    expect(calcularConfianca({ ...limpo, diff: diffExame(base(), semTarefas) })).toBeLessThan(LIMIAR_PUBLICACAO);
  });

  it("nunca fica negativa", () => {
    expect(calcularConfianca({ ...limpo, problemasLeitura: ["a", "b", "c", "d", "e"], diff: comPeso })).toBe(0);
  });
});
