/*
 * Nenhum teste fala com a internet: IA e serviços externos são sempre mockados. Qualquer fetch para
 * fora da máquina falha aqui (o banco de integração usa TCP local, não fetch).
 */
const LOCAIS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const fetchOriginal = globalThis.fetch;

export class RedeBloqueadaError extends Error {
  constructor(host: string) {
    super(`Rede bloqueada nos testes: ${host}. Injete um fetch/chamada mockada.`);
    this.name = "RedeBloqueadaError";
  }
}

globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
  if (!LOCAIS.has(url.hostname)) throw new RedeBloqueadaError(url.hostname);
  return fetchOriginal(entrada, init);
}) as typeof fetch;
