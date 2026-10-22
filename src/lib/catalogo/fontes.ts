/**
 * Hosts oficiais de onde o catálogo pode citar e (na pipeline) coletar dados.
 * Fora desta lista, a URL é recusada (seguranca-vibecoding §11).
 */
export const HOSTS_OFICIAIS = ["docs.aws.amazon.com", "aws.amazon.com"] as const;

/** URL https de um host oficial, sem credenciais nem porta. Função pura. */
export function urlOficial(valor: string): boolean {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    (HOSTS_OFICIAIS as readonly string[]).includes(url.hostname)
  );
}
