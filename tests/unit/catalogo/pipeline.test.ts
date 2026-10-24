import { describe, expect, it } from "vitest";
import { urlMarkdown } from "@/lib/catalogo/guia";
import { verificarExame } from "@/lib/catalogo/pipeline";
import type { ExameColetado } from "@/lib/catalogo/schemas";
import { EXAMES_INICIAIS } from "../../../prisma/catalogo/exames";
import { buscarEm, guiaEmMarkdown } from "../../apoio/guia-markdown";

const HOJE = "2026-11-01";

describe("verificarExame", () => {
  it.each(EXAMES_INICIAIS.map((e) => [e.codigo, e] as const))(
    "%s: guia igual ao gravado não muda nada",
    async (_, exame) => {
      const v = await verificarExame(exame, buscarEm(guiaEmMarkdown(exame)), HOJE);
      expect(v).toMatchObject({ decisao: "SEM_MUDANCA", confianca: 1, problemas: [] });
      expect(v.exame.lidoEm).toBe(HOJE);
    },
  );

  it("mudança de peso coerente publica sozinha", async () => {
    const atual = EXAMES_INICIAIS[0]!;
    const novo = structuredClone(atual) as ExameColetado;
    novo.dominios[0]!.peso = 22;
    novo.dominios[1]!.peso = 32;
    const v = await verificarExame(atual, buscarEm(guiaEmMarkdown(novo)), HOJE);
    expect(v.decisao).toBe("PUBLICAR");
    expect(v.diff.pesos).toHaveLength(2);
  });

  it("pesos que não somam 100 vão para a moderação", async () => {
    const atual = EXAMES_INICIAIS[0]!;
    const novo = structuredClone(atual) as ExameColetado;
    novo.dominios[0]!.peso = 50;
    const v = await verificarExame(atual, buscarEm(guiaEmMarkdown(novo)), HOJE);
    expect(v.decisao).toBe("MODERAR");
    expect(v.problemas).toContain("Pesos somam 126%, não 100%.");
  });

  it("página de domínio fora do ar vai para a moderação", async () => {
    const atual = EXAMES_INICIAIS[0]!;
    const paginas = guiaEmMarkdown(atual);
    const base = urlMarkdown(atual.fonteGuia).replace(/[^/]+$/, "");
    paginas.delete(`${base}dominio2.md`);
    const v = await verificarExame(atual, buscarEm(paginas), HOJE);
    expect(v.decisao).toBe("MODERAR");
    expect(v.problemas[0]).toMatch(/Falha ao ler o domínio 2/);
  });

  it("guia fora do ar é erro, não mudança", async () => {
    await expect(verificarExame(EXAMES_INICIAIS[0]!, buscarEm(new Map()), HOJE)).rejects.toThrow(/404/);
  });

  it("recusa exame com fonte fora da allowlist", async () => {
    const exame = { ...EXAMES_INICIAIS[0]!, fonteGuia: "https://evil.example/guia.html" };
    await expect(verificarExame(exame, buscarEm(new Map()), HOJE)).rejects.toThrow(/allowlist/);
  });
});
