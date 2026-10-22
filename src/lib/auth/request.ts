import "server-only";
import { headers } from "next/headers";

/** IP do cliente atrás do proxy da Vercel. */
export async function getIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

export async function getUserAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}
