import { timingSafeEqual } from "node:crypto";

/** Chamada do Vercel Cron: header `Authorization: Bearer <CRON_SECRET>`. Sem segredo configurado, recusa. */
export function cronAutorizado(request: Request, segredo = process.env.CRON_SECRET): boolean {
  if (!segredo) return false;
  const recebido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
