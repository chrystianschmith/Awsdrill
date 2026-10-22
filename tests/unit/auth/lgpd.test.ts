import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RELACOES_DO_USUARIO, SELECT_EXPORTACAO } from "@/lib/auth/lgpd";

/** Modelos do schema.prisma com seus campos (nome e tipo), lidos do texto. */
function modelos(): Map<string, { nome: string; tipo: string }[]> {
  const schema = readFileSync(path.resolve(__dirname, "../../../prisma/schema.prisma"), "utf8");
  const mapa = new Map<string, { nome: string; tipo: string }[]>();
  for (const m of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const campos = [...(m[2] ?? "").matchAll(/^\s+(\w+)\s+([\w[\]?]+)/gm)].map((c) => ({
      nome: c[1] ?? "",
      tipo: (c[2] ?? "").replace(/[[\]?]/g, ""),
    }));
    mapa.set(m[1] ?? "", campos);
  }
  return mapa;
}

describe("LGPD: exportação cobre todos os dados do usuário", () => {
  const todos = modelos();
  const user = todos.get("User") ?? [];
  const relacoes = user.filter((c) => todos.has(c.tipo));

  it("toda relação de User está classificada (exportada ou com motivo)", () => {
    expect(relacoes.length).toBeGreaterThan(0);
    const classificadas = Object.keys(RELACOES_DO_USUARIO);
    expect(relacoes.map((r) => r.nome).sort()).toEqual(classificadas.sort());
  });

  it("todo modelo com userId está ligado a User", () => {
    const tiposLigados = new Set(relacoes.map((r) => r.tipo));
    const comUserId = [...todos].filter(([, campos]) => campos.some((c) => c.nome === "userId")).map(([nome]) => nome);
    expect(comUserId.length).toBeGreaterThan(0);
    for (const modelo of comUserId) expect(tiposLigados, modelo).toContain(modelo);
  });

  it("as relações marcadas como exportadas estão na seleção da exportação", () => {
    for (const [relacao, destino] of Object.entries(RELACOES_DO_USUARIO)) {
      if (destino === "exportado") expect(SELECT_EXPORTACAO, relacao).toHaveProperty(relacao);
      else expect(SELECT_EXPORTACAO, relacao).not.toHaveProperty(relacao);
    }
  });

  it("os campos escalares de User são exportados, menos o hash da senha", () => {
    const escalares = user.filter((c) => !todos.has(c.tipo)).map((c) => c.nome);
    const fora = ["passwordHash", "deletedAt"];
    for (const campo of escalares) {
      if (fora.includes(campo)) expect(SELECT_EXPORTACAO).not.toHaveProperty(campo);
      else expect(SELECT_EXPORTACAO, campo).toHaveProperty(campo);
    }
  });
});
