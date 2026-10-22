import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Neon usa o driver serverless (WebSocket nativo do Node 22+); qualquer outro
 * Postgres (local, CI) usa o driver pg.
 */
export function createAdapter(connectionString: string) {
  if (/\.neon\.tech/.test(connectionString)) return new PrismaNeon({ connectionString });
  return new PrismaPg({ connectionString });
}
