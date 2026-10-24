import { Text } from "@react-email/components";
import { EmailLayout, paragrafo } from "@/emails/layout";
import { formatarDataLonga } from "@/lib/assinaturas/formatar";

export const assuntoLembretePix = "Seu acesso Pro termina em 7 dias";

/** Lembrete 7 dias antes do fim do acesso anual pago via Pix. */
export default function LembreteRenovacaoPixEmail({
  nome,
  accessUntil,
  appUrl,
}: {
  nome: string;
  accessUntil: Date;
  appUrl: string;
}) {
  return (
    <EmailLayout preview="Seu acesso Pro termina em 7 dias" appUrl={appUrl} action={{ label: "Renovar o Pro", href: `${appUrl}/precos` }}>
      <Text style={paragrafo}>Olá, {nome}.</Text>
      <Text style={paragrafo}>
        Seu plano Pro anual pago via Pix vale até {formatarDataLonga(accessUntil)}. O Pix não renova sozinho.
      </Text>
      <Text style={paragrafo}>
        Para continuar no Pro, faça um novo pagamento anual (os 12 meses são somados ao acesso atual) ou assine no cartão.
      </Text>
    </EmailLayout>
  );
}
