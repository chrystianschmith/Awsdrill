import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

let client: Resend | null = null;

export type EmailInput = { to: string; subject: string; react: ReactElement };

/** Caixa de saída em memória usada nos testes e quando não há RESEND_API_KEY. */
export const outbox: EmailInput[] = [];

/**
 * Pasta onde os testes e2e leem os e-mails (EMAIL_SINK_DIR). Só vale fora de
 * produção ou com E2E=1, e nunca num deploy de produção da Vercel.
 */
export function pastaSinkEmail(e: Record<string, string | undefined> = process.env): string | null {
  const dir = e.EMAIL_SINK_DIR;
  if (!dir) return null;
  if (e.VERCEL_ENV === "production") return null;
  if (e.NODE_ENV !== "production" || e.E2E === "1") return dir;
  return null;
}

async function gravarNoSink(dir: string, input: EmailInput): Promise<void> {
  const html = await render(input.react);
  await mkdir(dir, { recursive: true });
  const nome = `${Date.now()}-${randomUUID()}.json`;
  await writeFile(path.join(dir, nome), JSON.stringify({ to: input.to, subject: input.subject, html }));
}

/**
 * Envia um e-mail transacional. Sem RESEND_API_KEY (dev/test), guarda em
 * `outbox` (e em EMAIL_SINK_DIR, nos testes e2e) em vez de enviar.
 */
export async function sendEmail(input: EmailInput): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY) {
    outbox.push(input);
    const sink = pastaSinkEmail();
    if (sink) await gravarNoSink(sink, input);
    log("info", "email.simulado", { subject: input.subject });
    return;
  }
  client ??= new Resend(RESEND_API_KEY);
  const { error } = await client.emails.send({ from: EMAIL_FROM, to: input.to, subject: input.subject, react: input.react });
  if (error) {
    log("error", "email.falhou", { subject: input.subject, erro: error.message });
    throw new Error("Não foi possível enviar o e-mail.");
  }
}
