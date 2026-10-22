/*
 * Prontidão (etapa 5b). Função pura: recebe as respostas do usuário em um exame e o
 * blueprint vigente e devolve uma estimativa 0–100 com faixa. Não é nota prevista do exame.
 * A metodologia publicada em /metodologia e em docs/metodologia-prontidao.md descreve estas
 * regras; mudou a regra, mude a versão.
 */

export const METODOLOGIA_VERSAO = "1.0";
/** Peso de uma resposta cai à metade a cada 30 dias. */
export const MEIA_VIDA_DIAS = 30;
/** Respostas mais antigas que isso não entram (peso < 2%). */
export const JANELA_DIAS = 180;
/** Amostra mínima por tarefa: abaixo dela, as respostas que faltam contam como erro. */
export const MINIMO_POR_TAREFA = 3;
/** Abaixo disso a estimativa do exame é marcada como "amostra pequena". */
export const MINIMO_EXAME = 20;
/** Tarefa abaixo disso (0–100) entra no plano de correção mesmo coberta. */
export const ALVO_TAREFA = 70;
const Z = 1.96;
const DIA_MS = 86_400_000;

export type RespostaParaProntidao = {
  domainId: string;
  topicId: string | null;
  isCorrect: boolean;
  answeredAt: Date;
};

export type DominioDoBlueprint = {
  id: string;
  /** Peso efetivo (pesosEfetivos), em %. */
  peso: number;
  /** Tarefas vigentes (task statements). */
  tarefas: string[];
};

export type Estimativa = { score: number; lowerBound: number; upperBound: number };

export type ResultadoFolha = Estimativa & {
  /** topicId, ou `dominio:<id>` quando o domínio não tem tarefas. */
  id: string;
  /** Respostas que contam para a tarefa (as ligadas só ao domínio entram em partes iguais). */
  respostas: number;
  coberta: boolean;
};

export type ResultadoDominio = Estimativa & {
  domainId: string;
  peso: number;
  coverage: number;
  sampleSize: number;
  folhas: ResultadoFolha[];
};

export type ResultadoProntidao = Estimativa & {
  coverage: number;
  sampleSize: number;
  suficiente: boolean;
  methodologyVersion: string;
  dominios: ResultadoDominio[];
};

export function pesoPorIdade(answeredAt: Date, agora: Date): number {
  const dias = Math.max(0, (agora.getTime() - answeredAt.getTime()) / DIA_MS);
  return Math.pow(0.5, dias / MEIA_VIDA_DIAS);
}

/** Intervalo de Wilson (95%) para `acertos` em `n` tentativas (aceita n fracionário). */
export function wilson(acertos: number, n: number): { inferior: number; superior: number } {
  if (n <= 0) return { inferior: 0, superior: 1 };
  const p = Math.min(1, Math.max(0, acertos / n));
  const z2 = Z * Z;
  const centro = p + z2 / (2 * n);
  const margem = Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  const den = 1 + z2 / n;
  return { inferior: Math.max(0, (centro - margem) / den), superior: Math.min(1, (centro + margem) / den) };
}

const arred = (x: number) => Math.round(x * 10) / 10;

/**
 * Estimativa de uma tarefa. Com menos que MINIMO_POR_TAREFA respostas equivalentes (após o
 * decaimento), as que faltam contam como erro no escore e no limite inferior e como acerto
 * no superior. Assim acertar nunca baixa e errar nunca sobe a estimativa.
 */
export function estimarFolha(pesos: { peso: number; certo: boolean }[]): Estimativa {
  const nEf = pesos.reduce((s, r) => s + r.peso, 0);
  const acertos = pesos.reduce((s, r) => s + (r.certo ? r.peso : 0), 0);
  const n = Math.max(nEf, MINIMO_POR_TAREFA);
  const faltam = n - nEf;
  return {
    score: (acertos / n) * 100,
    lowerBound: wilson(acertos, n).inferior * 100,
    upperBound: wilson(acertos + faltam, n).superior * 100,
  };
}

const media = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);

export function calcularProntidao(
  respostas: RespostaParaProntidao[],
  blueprint: DominioDoBlueprint[],
  agora: Date,
): ResultadoProntidao {
  const limite = agora.getTime() - JANELA_DIAS * DIA_MS;
  const porFolha = new Map<string, { peso: number; certo: boolean; conta: number }[]>();
  const dominioDe = new Map(blueprint.map((d) => [d.id, d]));
  const somar = (folha: string, r: RespostaParaProntidao, fator: number) => {
    const lista = porFolha.get(folha) ?? [];
    lista.push({ peso: pesoPorIdade(r.answeredAt, agora) * fator, certo: r.isCorrect, conta: fator });
    porFolha.set(folha, lista);
  };
  for (const r of respostas) {
    const d = dominioDe.get(r.domainId);
    if (r.answeredAt.getTime() < limite || !d) continue;
    if (r.topicId && d.tarefas.includes(r.topicId)) somar(r.topicId, r, 1);
    else if (d.tarefas.length === 0) somar(`dominio:${d.id}`, r, 1);
    // Questão ligada só ao domínio (ou a tarefa que saiu do exam guide): vale para todas as
    // tarefas do domínio em partes iguais, sem criar folha nova (mantém a monotonia).
    else for (const t of d.tarefas) somar(t, r, 1 / d.tarefas.length);
  }

  const rsDoDominio = (id: string) =>
    respostas.filter((r) => r.domainId === id && r.answeredAt.getTime() >= limite).length;
  const dominios: ResultadoDominio[] = blueprint.map((d) => {
    const ids = d.tarefas.length > 0 ? d.tarefas : [`dominio:${d.id}`];
    const folhas = ids.map((id) => {
      const rs = porFolha.get(id) ?? [];
      const contadas = rs.reduce((s, r) => s + r.conta, 0);
      return { id, respostas: contadas, coberta: contadas >= MINIMO_POR_TAREFA - 1e-9, ...estimarFolha(rs) };
    });
    return {
      domainId: d.id,
      peso: d.peso,
      score: media(folhas.map((f) => f.score)),
      lowerBound: media(folhas.map((f) => f.lowerBound)),
      upperBound: media(folhas.map((f) => f.upperBound)),
      coverage: folhas.filter((f) => f.coberta).length / folhas.length,
      sampleSize: rsDoDominio(d.id),
      folhas,
    };
  });
  const somaPesos = dominios.reduce((s, d) => s + d.peso, 0);
  const ponderada = (f: (d: ResultadoDominio) => number) =>
    somaPesos === 0 ? 0 : dominios.reduce((s, d) => s + d.peso * f(d), 0) / somaPesos;
  const sampleSize = dominios.reduce((s, d) => s + d.sampleSize, 0);
  const fmt = (d: ResultadoDominio): ResultadoDominio => ({
    ...d,
    score: arred(d.score),
    lowerBound: arred(d.lowerBound),
    upperBound: arred(d.upperBound),
    folhas: d.folhas.map((f) => ({
      ...f,
      respostas: arred(f.respostas),
      score: arred(f.score),
      lowerBound: arred(f.lowerBound),
      upperBound: arred(f.upperBound),
    })),
  });
  return {
    score: arred(ponderada((d) => d.score)),
    lowerBound: arred(ponderada((d) => d.lowerBound)),
    upperBound: arred(ponderada((d) => d.upperBound)),
    coverage: ponderada((d) => d.coverage),
    sampleSize,
    suficiente: sampleSize >= MINIMO_EXAME,
    methodologyVersion: METODOLOGIA_VERSAO,
    dominios: dominios.map(fmt),
  };
}

/** Taxa de acerto recente por domínio (com decaimento), para o fator de desempenho do ciclo. */
export function taxaDeAcertoPorDominio(respostas: RespostaParaProntidao[], agora: Date): Map<string, number> {
  const limite = agora.getTime() - JANELA_DIAS * DIA_MS;
  const somas = new Map<string, { n: number; acertos: number }>();
  for (const r of respostas) {
    if (r.answeredAt.getTime() < limite) continue;
    const w = pesoPorIdade(r.answeredAt, agora);
    const s = somas.get(r.domainId) ?? { n: 0, acertos: 0 };
    s.n += w;
    if (r.isCorrect) s.acertos += w;
    somas.set(r.domainId, s);
  }
  return new Map([...somas].map(([id, s]) => [id, s.acertos / s.n]));
}

export type ItemCorrecao = {
  domainId: string;
  /** null quando o domínio não tem tarefas. */
  topicId: string | null;
  motivo: "sem_respostas" | "amostra_pequena" | "acerto_baixo";
  score: number;
  prioridade: number;
};

/**
 * Plano de correção: tarefas fracas ou sem amostra, das que mais pesam no exame para as que
 * menos pesam (peso do domínio × o que falta para 100 / número de tarefas do domínio).
 */
export function planoDeCorrecao(resultado: ResultadoProntidao, limite = 5): ItemCorrecao[] {
  const itens: ItemCorrecao[] = [];
  for (const d of resultado.dominios) {
    for (const f of d.folhas) {
      const motivo =
        f.respostas === 0
          ? "sem_respostas"
          : !f.coberta
            ? "amostra_pequena"
            : f.score < ALVO_TAREFA
              ? "acerto_baixo"
              : null;
      if (!motivo) continue;
      itens.push({
        domainId: d.domainId,
        topicId: f.id.startsWith("dominio:") ? null : f.id,
        motivo,
        score: f.score,
        prioridade: (d.peso * (100 - f.score)) / 100 / d.folhas.length,
      });
    }
  }
  return itens.sort((a, b) => b.prioridade - a.prioridade).slice(0, limite);
}
