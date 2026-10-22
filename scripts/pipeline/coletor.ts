import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { BRAND } from "@/lib/brand";
import { HOSTS_OFICIAIS } from "@/lib/catalogo/fontes";
import { hostLocal, ipBloqueado } from "@/lib/catalogo/rede";
import { parseRobots, permitidoPorRobots, type RegrasRobots } from "@/lib/catalogo/robots";

export class ColetaError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ColetaError";
  }
}

export type OpcoesColetor = {
  /** E-mail de contato no User-Agent (PIPELINE_CONTACT_EMAIL). */
  contato: string;
  timeoutMs?: number;
  tentativas?: number;
  /** Intervalo mínimo entre requisições ao mesmo domínio (padrão 1 s). */
  intervaloMs?: number;
  maxBytes?: number;
  /** Allowlist de hosts exatos; vale também para cada redirect. Padrão: HOSTS_OFICIAIS. */
  hosts?: readonly string[];
  /** Resolve o host para IPs (padrão: DNS do sistema). Usado para recusar destinos internos. */
  resolver?: (hostname: string) => Promise<string[]>;
  fetchImpl?: typeof fetch;
  dormir?: (ms: number) => Promise<void>;
};

export type Resposta = { url: string; tipo: string; corpo: Uint8Array };

const RETENTAVEL = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_REDIRECTS = 3;

async function resolverDns(hostname: string): Promise<string[]> {
  return (await lookup(hostname, { all: true })).map((r) => r.address);
}

/**
 * Coletor do catálogo, adaptado do coletor de editais do Prumo. Só https e só os hosts da allowlist.
 * Coletor educado: respeita robots.txt, se identifica com e-mail de contato,
 * faz no máximo 1 requisição por segundo por domínio (ou o Crawl-delay do
 * site, se maior), aplica timeout e tenta de novo com backoff exponencial.
 */
export class Coletor {
  readonly userAgent: string;
  private readonly robots = new Map<string, Promise<RegrasRobots & { erro?: string }>>();
  private readonly proximaLiberacao = new Map<string, number>();
  private readonly o: Required<Omit<OpcoesColetor, "contato">>;

  constructor(opcoes: OpcoesColetor) {
    // Segredos colados no GitHub costumam vir com quebra de linha no fim, que é inválida em cabeçalho HTTP.
    const contato = opcoes.contato.trim();
    if (!/^[^\s@]+@[^\s@]+$/.test(contato)) throw new Error("PIPELINE_CONTACT_EMAIL deve ser um e-mail válido.");
    this.userAgent = `${BRAND.name}CatalogoBot/1.0 (leitura mensal de exam guides publicos; contato: ${contato})`;
    this.o = {
      timeoutMs: opcoes.timeoutMs ?? 30_000,
      tentativas: opcoes.tentativas ?? 3,
      intervaloMs: opcoes.intervaloMs ?? 1_000,
      // Um exam guide em Markdown tem dezenas de KB.
      maxBytes: opcoes.maxBytes ?? 2 * 1024 * 1024,
      hosts: opcoes.hosts ?? HOSTS_OFICIAIS,
      resolver: opcoes.resolver ?? resolverDns,
      fetchImpl: opcoes.fetchImpl ?? fetch,
      dormir: opcoes.dormir ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    };
  }

  /** Só https, sem credenciais nem porta, host exato da allowlist. Roda antes de qualquer requisição. */
  private validarUrl(url: string): URL {
    const u = new URL(url);
    if (u.protocol !== "https:") throw new ColetaError("Protocolo não suportado", url);
    if (u.username || u.password || u.port || !this.o.hosts.includes(u.hostname.toLowerCase())) {
      throw new ColetaError(`Host fora da lista de fontes oficiais: ${u.host}`, url);
    }
    return u;
  }

  /** Recusa protocolo, domínio fora da allowlist e destinos internos (SSRF). */
  private async validarDestino(url: string): Promise<URL> {
    const u = this.validarUrl(url);
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (hostLocal(host)) throw new ColetaError("Destino interno recusado", url);
    let ips: string[];
    if (isIP(host)) {
      ips = [host];
    } else {
      try {
        ips = await this.o.resolver(host);
      } catch (err) {
        throw new ColetaError(`DNS falhou para ${host}: ${err instanceof Error ? err.message : String(err)}`, url);
      }
    }
    if (ips.length === 0 || ips.some(ipBloqueado)) throw new ColetaError("Destino interno recusado", url);
    return u;
  }

  /** fetch com redirects seguidos manualmente (no máximo 3), validando cada destino. */
  private async buscar(url: string, signal: AbortSignal): Promise<Response> {
    let atual = url;
    for (let salto = 0; ; salto++) {
      await this.validarDestino(atual);
      const res = await this.o.fetchImpl(atual, {
        headers: { "User-Agent": this.userAgent, Accept: "text/markdown,text/plain;q=0.9,text/html;q=0.8,*/*;q=0.5" },
        redirect: "manual",
        signal,
      });
      const destino = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !destino) return res;
      if (salto >= MAX_REDIRECTS) throw new ColetaError(`Redirects demais a partir de ${url}`, url);
      atual = new URL(destino, atual).toString();
    }
  }

  private async aguardarVez(host: string, crawlDelaySeg: number | null): Promise<void> {
    const intervalo = Math.max(this.o.intervaloMs, (crawlDelaySeg ?? 0) * 1000);
    const agora = Date.now();
    const liberadoEm = this.proximaLiberacao.get(host) ?? 0;
    const espera = Math.max(0, liberadoEm - agora);
    this.proximaLiberacao.set(host, Math.max(agora, liberadoEm) + intervalo);
    if (espera > 0) await this.o.dormir(espera);
  }

  private regrasDe(origem: string): Promise<RegrasRobots & { erro?: string }> {
    let p = this.robots.get(origem);
    if (!p) {
      p = (async () => {
        try {
          const r = await this.requisitar(`${origem}/robots.txt`, null, 1);
          return parseRobots(new TextDecoder().decode(r.corpo), this.userAgent);
        } catch (err) {
          // RFC 9309: 4xx = sem restrições; erro de servidor/rede = tudo bloqueado.
          if (err instanceof ColetaError && err.status && err.status >= 400 && err.status < 500) return { regras: [], crawlDelaySeg: null };
          const motivo = err instanceof Error ? err.message : String(err);
          return { regras: [{ allow: false, padrao: "/" }], crawlDelaySeg: null, erro: `robots.txt inacessível (${motivo})` };
        }
      })();
      this.robots.set(origem, p);
    }
    return p;
  }

  private async requisitar(url: string, crawlDelaySeg: number | null, tentativas = this.o.tentativas): Promise<Resposta> {
    const host = new URL(url).host;
    let ultimoErro: unknown;
    for (let i = 0; i < tentativas; i++) {
      await this.aguardarVez(host, crawlDelaySeg);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.o.timeoutMs);
      try {
        const res = await this.buscar(url, ctrl.signal);
        if (!res.ok) {
          const erro = new ColetaError(`HTTP ${res.status} em ${url}`, url, res.status);
          if (!RETENTAVEL.has(res.status)) throw erro;
          ultimoErro = erro;
          const retryAfter = Number(res.headers.get("retry-after"));
          await this.o.dormir(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 120) * 1000 : backoff(i));
          continue;
        }
        const tamanho = Number(res.headers.get("content-length") ?? 0);
        if (tamanho > this.o.maxBytes) throw new ColetaError(`Documento grande demais (${tamanho} bytes)`, url);
        const corpo = new Uint8Array(await res.arrayBuffer());
        if (corpo.byteLength > this.o.maxBytes) throw new ColetaError(`Documento grande demais (${corpo.byteLength} bytes)`, url);
        return { url: res.url || url, tipo: res.headers.get("content-type") ?? "", corpo };
      } catch (err) {
        if (err instanceof ColetaError && err.status && !RETENTAVEL.has(err.status)) throw err;
        if (err instanceof ColetaError && !err.status) throw err;
        ultimoErro = err;
        if (i < tentativas - 1) await this.o.dormir(backoff(i));
      } finally {
        clearTimeout(timer);
      }
    }
    if (ultimoErro instanceof ColetaError) throw ultimoErro;
    throw new ColetaError(`Falha ao acessar ${url}: ${descreverErro(ultimoErro)}`, url);
  }

  /** Baixa uma URL respeitando robots.txt. */
  async obter(url: string): Promise<Resposta> {
    const u = this.validarUrl(url);
    const regras = await this.regrasDe(u.origin);
    if (regras.erro) throw new ColetaError(`${regras.erro}; coleta suspensa para ${u.host}`, url);
    if (!permitidoPorRobots(regras, u.pathname + u.search)) throw new ColetaError("Bloqueado pelo robots.txt", url);
    return this.requisitar(url, regras.crawlDelaySeg);
  }

  /** Texto (Markdown ou HTML) decodificado pelo charset declarado. */
  async obterTexto(url: string): Promise<string> {
    const r = await this.obter(url);
    if (/^(application\/pdf|image\/|audio\/|video\/)/i.test(r.tipo)) throw new ColetaError(`Tipo inesperado: ${r.tipo}`, url);
    return decodificarTexto(r.corpo, r.tipo);
  }
}

/** Decodifica pelo charset do cabeçalho; sem declaração, UTF-8 (o padrão da documentação da AWS). */
export function decodificarTexto(corpo: Uint8Array, contentType = ""): string {
  const declarado = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  try {
    return new TextDecoder(declarado?.trim().toLowerCase() ?? "utf-8").decode(corpo);
  } catch {
    return new TextDecoder("utf-8").decode(corpo);
  }
}

/** "fetch failed" sozinho não diz nada; a causa (ECONNRESET, timeout, certificado) fica em `cause`. */
function descreverErro(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const causa = err.cause as { code?: unknown; message?: unknown } | undefined;
  const detalhe = [causa?.code, causa?.message].filter((x) => typeof x === "string" && x).join(" ");
  return detalhe ? `${err.message} (${detalhe})` : err.message;
}

function backoff(tentativa: number): number {
  return 1000 * 2 ** tentativa + Math.floor(Math.random() * 250);
}
