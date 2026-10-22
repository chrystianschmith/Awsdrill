import { Text } from "@react-email/components";
import { EmailLayout, paragrafo } from "@/emails/layout";
import { BRAND } from "@/lib/brand";

export function EmailConfirmacao({ nome, link, appUrl }: { nome: string; link: string; appUrl: string }) {
  return (
    <EmailLayout
      preview={`Confirme seu e-mail no ${BRAND.name}`}
      appUrl={appUrl}
      action={{ label: "Confirmar e-mail", href: link }}
    >
      <Text style={paragrafo}>Olá, {nome}.</Text>
      <Text style={paragrafo}>
        Confirme seu e-mail para receber lembretes de revisão e avisos quando o exame que você estuda mudar. O link
        vale por 24 horas e só pode ser usado uma vez.
      </Text>
      <Text style={paragrafo}>Se você não criou uma conta, ignore este e-mail.</Text>
    </EmailLayout>
  );
}

export default function Preview() {
  return (
    <EmailConfirmacao
      nome="Ana"
      link="http://localhost:3000/confirmar-email?token=exemplo"
      appUrl="http://localhost:3000"
    />
  );
}
