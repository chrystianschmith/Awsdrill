import type { Metadata } from "next";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sair } from "@/lib/auth/actions";
import { AvisoEmailNaoConfirmado } from "@/lib/auth/components";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ExcluirConta } from "./_components/excluir-conta";
import { FormDados } from "./_components/form-dados";
import { FormPreferencias } from "./_components/form-preferencias";
import { FormSenha } from "./_components/form-senha";

export const metadata: Metadata = { title: "Conta" };

const PREFERENCIAS_PADRAO = { revisoes: true, mudancaExame: true, recertificacao: true, avisosPagamento: true };

export default async function ContaPage() {
  const user = await requireUser();
  const prefs = await db.notificationPreference.findUnique({
    where: { userId: user.id },
    select: { revisoes: true, mudancaExame: true, recertificacao: true, avisosPagamento: true },
  });

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Conta</h1>
        <p className="text-sm text-muted-foreground">Seus dados, segurança, e-mails e privacidade.</p>
      </div>

      <AvisoEmailNaoConfirmado />

      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
          <CardDescription>
            E-mail de acesso: <span className="font-medium text-foreground">{user.email}</span>
            {user.emailVerified ? null : " (não confirmado)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormDados nome={user.name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Senha</CardTitle>
          <CardDescription>Ao trocar a senha, as sessões em outros dispositivos são encerradas.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormSenha />
        </CardContent>
      </Card>

      <Card id="notificacoes" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Notificações por e-mail</CardTitle>
          <CardDescription>Escolha o que você quer receber.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormPreferencias valores={prefs ?? PREFERENCIAS_PADRAO} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacidade e dados</CardTitle>
          <CardDescription>
            Você pode baixar uma cópia de todos os seus dados ou excluir a conta a qualquer momento. Saiba mais na{" "}
            <Link href="/privacidade" className="text-primary-strong underline underline-offset-4">
              política de privacidade
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-2">
            <p className="text-sm font-medium">Exportar meus dados</p>
            <p className="text-sm text-muted-foreground">
              Arquivo JSON com cadastro, aceites, preferências e histórico de acesso.
            </p>
            <a
              href="/api/conta/exportar"
              download
              className={buttonVariants({ variant: "secondary", className: "w-fit" })}
            >
              Baixar meus dados
            </a>
          </div>
          <div className="grid gap-2 border-t border-border pt-6">
            <p className="text-sm font-medium">Excluir conta</p>
            <p className="text-sm text-muted-foreground">
              Apaga seus dados pessoais na hora. Registros de segurança ficam sem vínculo com você.
            </p>
            <ExcluirConta />
          </div>
        </CardContent>
      </Card>

      <form action={sair}>
        <Button type="submit" variant="ghost" className="w-fit">
          Sair desta conta
        </Button>
      </form>
    </div>
  );
}
