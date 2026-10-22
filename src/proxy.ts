import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "tr_sessao";
export const PRIVADAS = ["/hoje", "/estudar", "/simulados", "/prontidao", "/revisoes", "/carteira", "/progresso", "/conta", "/admin"];

/**
 * Checagem otimista de sessão (só presença do cookie) e headers de segurança.
 * A autorização real é refeita em cada página, action e rota no servidor.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PRIVADAS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/entrar", request.url);
    url.searchParams.set("voltar", pathname + search);
    return NextResponse.redirect(url);
  }

  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.stripe.com",
    "font-src 'self'",
    "connect-src 'self' https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)");
  if (!dev) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/stripe/webhook|api/cron|api/saude|_next/static|_next/image|icon.svg|icons/|fonts/|sw.js|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
