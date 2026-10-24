import { Text } from "@react-email/components";
import { EmailLayout, paragrafo } from "@/emails/layout";
import { formatarDataLonga } from "@/lib/assinaturas/formatar";

export const assuntoAssinaturaAtivada = "Seu plano Pro está ativo";

/** Pro liberado, por cartão ou Pix. */
export default function AssinaturaAtivadaEmail({
  nome,
  via,
  acessoAte,
  appUrl,
}: {
  nome: string;
  via: "cartao" | "pix";
  acessoAte: Date | null;
  appUrl: string;
}) {
  return (
    <EmailLayout preview="Seu plano Pro está ativo" appUrl={appUrl} action={{ label: "Ir para Hoje", href: `${appUrl}/hoje` }}>
      <Text style={paragrafo}>Olá, {nome}.</Text>
      <Text style={paragrafo}>
        Seu plano Pro está ativo. Modo prova, prontidão por domínio, material com IA, ciclo de estudos,
        revisão espaçada e exames ilimitados já estão liberados.
      </Text>
      {via === "pix" && acessoAte ? (
        <Text style={paragrafo}>
          Recebemos seu Pix. O acesso vale até {formatarDataLonga(acessoAte)}; avisaremos 7 dias antes para você renovar.
        </Text>
      ) : null}
      {via === "cartao" && acessoAte ? (
        <Text style={paragrafo}>
          A próxima cobrança no cartão será em {formatarDataLonga(acessoAte)}. Você pode cancelar quando quiser em Conta,
          Assinatura.
        </Text>
      ) : null}
    </EmailLayout>
  );
}
