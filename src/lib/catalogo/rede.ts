import { isIP } from "node:net";

/**
 * Proteção contra SSRF do coletor do catálogo: endereços que nunca podem ser
 * acessados (loopback, redes privadas, link-local/metadata, CGNAT, multicast).
 */
export function ipBloqueado(ip: string): boolean {
  const versao = isIP(ip);
  if (versao === 4) return ipv4Bloqueado(ip);
  if (versao === 6) {
    const v6 = ip.toLowerCase();
    const mapeado = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeado) return ipv4Bloqueado(mapeado[1]!);
    return (
      v6 === "::" ||
      v6 === "::1" ||
      /^f[cd]/.test(v6) || // fc00::/7 (ULA)
      /^fe[89ab]/.test(v6) || // fe80::/10 (link-local)
      /^ff/.test(v6) // multicast
    );
  }
  return true;
}

function ipv4Bloqueado(ip: string): boolean {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local e metadata da nuvem
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast e reservados
  );
}

/** Hostnames locais recusados antes mesmo da resolução de DNS. */
export function hostLocal(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal");
}
