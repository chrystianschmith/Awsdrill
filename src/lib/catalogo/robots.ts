/**
 * Parser simples de robots.txt: grupos por User-agent, regras Allow/Disallow
 * com curinga "*" e âncora "$", regra mais específica (mais longa) vence e,
 * no empate, Allow vence. Crawl-delay é lido para respeitar intervalos
 * maiores que o padrão de 1 s.
 */
export type RegrasRobots = {
  regras: { allow: boolean; padrao: string }[];
  crawlDelaySeg: number | null;
};

type Grupo = { agentes: string[]; regras: RegrasRobots["regras"]; crawlDelaySeg: number | null };

export function parseRobots(conteudo: string, userAgent: string): RegrasRobots {
  const grupos: Grupo[] = [];
  let atual: Grupo | null = null;
  let ultimaFoiAgente = false;

  for (const linhaBruta of conteudo.split(/\r?\n/)) {
    const linha = linhaBruta.replace(/#.*$/, "").trim();
    if (!linha) continue;
    const idx = linha.indexOf(":");
    if (idx === -1) continue;
    const campo = linha.slice(0, idx).trim().toLowerCase();
    const valor = linha.slice(idx + 1).trim();

    if (campo === "user-agent") {
      if (!atual || !ultimaFoiAgente) {
        atual = { agentes: [], regras: [], crawlDelaySeg: null };
        grupos.push(atual);
      }
      atual.agentes.push(valor.toLowerCase());
      ultimaFoiAgente = true;
      continue;
    }
    ultimaFoiAgente = false;
    if (!atual) continue;
    if (campo === "disallow") {
      if (valor) atual.regras.push({ allow: false, padrao: valor });
    } else if (campo === "allow") {
      if (valor) atual.regras.push({ allow: true, padrao: valor });
    } else if (campo === "crawl-delay") {
      const n = Number(valor);
      if (Number.isFinite(n) && n >= 0) atual.crawlDelaySeg = n;
    }
  }

  const ua = userAgent.toLowerCase();
  const especifico = grupos.filter((g) => g.agentes.some((a) => a !== "*" && ua.includes(a)));
  const escolhidos = especifico.length > 0 ? especifico : grupos.filter((g) => g.agentes.includes("*"));
  return {
    regras: escolhidos.flatMap((g) => g.regras),
    crawlDelaySeg: escolhidos.reduce<number | null>((m, g) => (g.crawlDelaySeg == null ? m : Math.max(m ?? 0, g.crawlDelaySeg)), null),
  };
}

function casa(padrao: string, caminho: string): boolean {
  const ancorado = padrao.endsWith("$");
  const corpo = ancorado ? padrao.slice(0, -1) : padrao;
  const re = corpo
    .split("*")
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${re}${ancorado ? "$" : ""}`).test(caminho);
}

/** O caminho (path + query) pode ser coletado? */
export function permitidoPorRobots(regras: RegrasRobots, caminho: string): boolean {
  let melhor: { allow: boolean; tamanho: number } | null = null;
  for (const r of regras.regras) {
    if (!casa(r.padrao, caminho)) continue;
    const tamanho = r.padrao.length;
    if (!melhor || tamanho > melhor.tamanho || (tamanho === melhor.tamanho && r.allow)) melhor = { allow: r.allow, tamanho };
  }
  return melhor?.allow ?? true;
}
