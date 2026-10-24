import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "./cookie";
import { gerarToken, hashToken } from "./tokens";

export { SESSION_COOKIE };
const DURACAO_MS = 30 * 24 * 60 * 60 * 1000;
const RENOVAR_APOS_MS = 24 * 60 * 60 * 1000;

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  emailVerified: boolean;
};

async function gravarCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Cria a sessão no banco e grava o cookie. */
export async function criarSessao(userId: string, userAgent?: string | null): Promise<void> {
  const token = gerarToken();
  const expiresAt = new Date(Date.now() + DURACAO_MS);
  await db.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, userAgent: userAgent?.slice(0, 200) ?? null },
  });
  await gravarCookie(token, expiresAt);
}

/** Encerra a sessão atual (logout). */
export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Revoga todas as sessões do usuário, exceto (opcionalmente) a atual. */
export async function revogarSessoes(userId: string, manterAtual = false): Promise<void> {
  let exceto: string | undefined;
  if (manterAtual) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) exceto = hashToken(token);
  }
  await db.session.deleteMany({ where: { userId, ...(exceto ? { NOT: { tokenHash: exceto } } : {}) } });
}

/** Usuário da requisição atual, ou null. Expiração deslizante de 30 dias. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sessao = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: { id: true, name: true, email: true, role: true, emailVerifiedAt: true, deletedAt: true },
      },
    },
  });
  const agora = Date.now();
  if (!sessao || sessao.expiresAt.getTime() < agora || sessao.user.deletedAt) return null;

  if (agora - sessao.lastSeenAt.getTime() > RENOVAR_APOS_MS) {
    const expiresAt = new Date(agora + DURACAO_MS);
    await db.session.update({ where: { id: sessao.id }, data: { lastSeenAt: new Date(agora), expiresAt } });
    try {
      await gravarCookie(token, expiresAt);
    } catch {
      // Em Server Components não é possível gravar cookie; renova na próxima action.
    }
  }

  const u = sessao.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    emailVerified: Boolean(u.emailVerifiedAt),
  };
});

/** Exige usuário logado; redireciona para /entrar se não houver. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  return user;
}

/** Exige papel ADMIN, checado no servidor. Para quem não é admin, a área não existe (404). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  return user;
}
