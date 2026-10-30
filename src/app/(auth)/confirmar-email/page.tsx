import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { audit } from "@/lib/auth/audit";
import { BotaoReenviarConfirmacao } from "@/lib/auth/components-client";
import { confirmarEmailComToken } from "@/lib/auth/fluxos";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Confirmar e-mail", referrer: "no-referrer" };

const MENSAGENS = {
  inexistente: "Este link de confirmação é inválido.",
  expirado: "Este link de confirmação expirou. Os links valem por 24 horas.",
  usado: "Este link já foi usado.",
} as const;

export default async function ConfirmarEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  const user = await getCurrentUser();

  if (typeof token === "string" && token.length > 0) {
    const resultado = await confirmarEmailComToken(token);
    if (resultado.estado === "ok") {
      await audit("email.confirmado", resultado.userId);
      return (
        <div className="grid gap-6">
          <h1 className="text-3xl font-extrabold tracking-tight">E-mail confirmado</h1>
          <p className="text-sm text-muted-foreground">Tudo certo. Você vai receber os avisos que escolher em Conta.</p>
          <Link href={user ? "/hoje" : "/entrar"} className={buttonVariants({ className: "w-full" })}>
            {user ? "Ir para Hoje" : "Entrar"}
          </Link>
        </div>
      );
    }
    const jaConfirmado = resultado.estado === "usado" && user?.emailVerified;
    return (
      <div className="grid gap-6">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {jaConfirmado ? "E-mail já confirmado" : "Link inválido"}
        </h1>
        {jaConfirmado ? (
          <p className="text-sm text-muted-foreground">Seu e-mail já estava confirmado.</p>
        ) : (
          <Alert tone="warning">{MENSAGENS[resultado.estado]}</Alert>
        )}
        {user && !user.emailVerified ? (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">Peça um novo link para {user.email}.</p>
            <BotaoReenviarConfirmacao className="w-fit" />
          </div>
        ) : (
          <Link
            href={user ? "/hoje" : "/entrar"}
            className={buttonVariants({ variant: "secondary", className: "w-full" })}
          >
            {user ? "Ir para Hoje" : "Entrar para pedir um novo link"}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Confirme seu e-mail</h1>
        <p className="text-sm text-muted-foreground">
          {user
            ? `Enviamos um link de confirmação para ${user.email}. Ele vale por 24 horas.`
            : "Abra o link que enviamos para o seu e-mail. Ele vale por 24 horas."}
        </p>
      </div>
      {user && user.emailVerified ? <Alert tone="success">Seu e-mail já está confirmado.</Alert> : null}
      {user && !user.emailVerified ? (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">Não chegou? Confira o spam ou peça outro link.</p>
          <BotaoReenviarConfirmacao className="w-fit" />
        </div>
      ) : null}
      <Link
        href={user ? "/hoje" : "/entrar"}
        className="w-fit text-sm text-primary-strong underline underline-offset-4"
      >
        {user ? "Ir para Hoje" : "Entrar"}
      </Link>
    </div>
  );
}
