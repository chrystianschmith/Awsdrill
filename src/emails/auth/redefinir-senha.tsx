import { Text } from "@react-email/components";
import { EmailLayout, paragrafo } from "@/emails/layout";
import { BRAND } from "@/lib/brand";

export function EmailRedefinirSenha({ nome, link, appUrl }: { nome: string; link: string; appUrl: string }) {
  return (
    <EmailLayout
      preview={`Redefinição de senha no ${BRAND.name}`}
      appUrl={appUrl}
      action={{ label: "Criar nova senha", href: link }}
    >
      <Text style={paragrafo}>Olá, {nome}.</Text>
      <Text style={paragrafo}>
        Recebemos um pedido para redefinir a senha da sua conta. O link vale por 30 minutos e só pode ser usado uma vez.
      </Text>
      <Text style={paragrafo}>Se não foi você, ignore este e-mail: sua senha continua a mesma.</Text>
    </EmailLayout>
  );
}

export default function Preview() {
  return (
    <EmailRedefinirSenha
      nome="Ana"
      link="http://localhost:3000/redefinir-senha?token=exemplo"
      appUrl="http://localhost:3000"
    />
  );
}
