/**
 * Destino alternativo da API (STRIPE_API_BASE, ex.: http://localhost:12111),
 * usado só pelo mock do Stripe nos testes e2e. Ignorado num deploy de produção.
 */
export function destinoApiStripe(
  e: Record<string, string | undefined> = process.env,
): { host: string; port: number; protocol: "http" | "https" } | null {
  const base = e.STRIPE_API_BASE;
  if (!base || e.VERCEL_ENV === "production") return null;
  const url = new URL(base);
  const protocol = url.protocol === "http:" ? "http" : "https";
  return { host: url.hostname, port: Number(url.port || (protocol === "http" ? 80 : 443)), protocol };
}
