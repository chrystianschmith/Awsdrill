import { Text } from "@react-email/components";
import { EmailLayout, paragrafo } from "@/emails/layout";
import { BRAND } from "@/lib/brand";

export function EmailSenhaAlterada({ nome, appUrl, quando }: { nome: string; appUrl: string; quando: string }) {
  return (
    <EmailLayout
      preview={`Sua senha do ${BRAND.name} foi alterada`}
      appUrl={appUrl}
      action={{ label: "Redefinir senha", href: `${appUrl}/esqueci-senha` }}
    >
      <Text style={paragrafo}>Olá, {nome}.</Text>
      <Text style={paragrafo}>
        A senha da sua conta foi alterada em {quando}. Por segurança, encerramos as sessões abertas em outros
        dispositivos.
      </Text>
      <Text style={paragrafo}>Se não foi você, redefina a senha agora e fale com a gente em {BRAND.supportEmail}.</Text>
    </EmailLayout>
  );
}

export default function Preview() {
  return <EmailSenhaAlterada nome="Ana" appUrl="http://localhost:3000" quando="8 de outubro de 2026, 14:30" />;
}
