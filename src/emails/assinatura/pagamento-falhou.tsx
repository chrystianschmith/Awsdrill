import { Text } from "@react-email/components";
import { EmailLayout, paragrafo } from "@/emails/layout";
import { formatarDataLonga } from "@/lib/assinaturas/formatar";

export const assuntoPagamentoFalhou = "Pagamento não aprovado: atualize seu cartão";

/** Falha na cobrança do cartão: o Pro continua durante os 3 dias de carência. */
export default function PagamentoFalhouEmail({
  nome,
  graceUntil,
  appUrl,
}: {
  nome: string;
  graceUntil: Date;
  appUrl: string;
}) {
  return (
    <EmailLayout
      preview="Não conseguimos cobrar sua assinatura Pro"
      appUrl={appUrl}
      action={{ label: "Atualizar forma de pagamento", href: `${appUrl}/conta/assinatura` }}
    >
      <Text style={paragrafo}>Olá, {nome}.</Text>
      <Text style={paragrafo}>
        Não conseguimos cobrar a renovação da sua assinatura Pro. Seu acesso continua normal até{" "}
        {formatarDataLonga(graceUntil)}.
      </Text>
      <Text style={paragrafo}>
        Atualize o cartão para manter os recursos Pro. Se nada mudar até lá, a conta volta ao plano Grátis, sem perder
        nenhum dado.
      </Text>
    </EmailLayout>
  );
}
