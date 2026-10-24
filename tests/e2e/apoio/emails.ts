import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";
import { PASTA_EMAILS } from "./constantes";

export type EmailGravado = { to: string; subject: string; html: string; arquivo: string };

async function lerEmails(): Promise<EmailGravado[]> {
  let nomes: string[];
  try {
    nomes = (await readdir(PASTA_EMAILS)).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const emails: EmailGravado[] = [];
  for (const arquivo of nomes) {
    const dados = JSON.parse(await readFile(path.join(PASTA_EMAILS, arquivo), "utf8")) as Omit<EmailGravado, "arquivo">;
    emails.push({ ...dados, arquivo });
  }
  return emails;
}

/**
 * Espera o e-mail mais recente para `para` com o assunto dado (o app envia
 * depois da resposta, com `after`). `depoisDe` ignora e-mails já vistos.
 */
export async function aguardarEmail(para: string, assunto: string, depoisDe?: string): Promise<EmailGravado> {
  let achado: EmailGravado | undefined;
  await expect
    .poll(
      async () => {
        const todos = await lerEmails();
        achado = todos
          .filter((e) => e.to === para && e.subject === assunto && (!depoisDe || e.arquivo > depoisDe))
          .at(-1);
        return Boolean(achado);
      },
      { message: `e-mail "${assunto}" para ${para}`, timeout: 15_000 },
    )
    .toBe(true);
  return achado as EmailGravado;
}

/** Link do e-mail que aponta para `caminho` (ex.: "/confirmar-email"). */
export function linkDoEmail(email: EmailGravado, caminho: string): string {
  const hrefs = [...email.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]?.replaceAll("&amp;", "&") ?? "");
  const link = hrefs.find((h) => new URL(h, "http://x").pathname === caminho);
  if (!link) throw new Error(`Link ${caminho} não encontrado no e-mail "${email.subject}". Links: ${hrefs.join(", ")}`);
  return link;
}
