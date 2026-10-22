/**
 * Destino seguro para o parâmetro `voltar` do login: só caminhos internos
 * começando com "/" e sem "//" (evita open redirect para outro domínio).
 */
export function destinoSeguro(voltar: unknown, padrao = "/hoje"): string {
  if (typeof voltar !== "string") return padrao;
  const v = voltar.trim();
  if (v.length === 0 || v.length > 512) return padrao;
  if (!v.startsWith("/")) return padrao;
  // "\" é tratado como "/" pelos navegadores ("/\evil.com" vira "//evil.com").
  if (v.includes("//") || v.includes("\\")) return padrao;
  // Caracteres de controle (tab, quebra de linha) são descartados pelos navegadores.
  if (/[\u0000-\u001f\u007f]/.test(v)) return padrao;
  if (v === "/entrar" || v.startsWith("/entrar?") || v.startsWith("/entrar/")) return padrao;
  return v;
}
