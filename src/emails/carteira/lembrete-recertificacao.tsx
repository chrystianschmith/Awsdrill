import { Text } from "@react-email/components";
import { EmailLayout, paragrafo } from "@/emails/layout";

export const assuntoLembreteRecertificacao = "Lembrete de recertificação";

export type ItemLembrete = { nome: string; vence: string; dias: number };

const quando = (dias: number) =>
  dias < 0 ? "venceu" : dias === 0 ? "vence hoje" : `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;

/** Um e-mail por dia com todas as certificações que chegaram a um estágio de lembrete. */
export default function LembreteRecertificacaoEmail({
  nome,
  itens,
  appUrl,
}: {
  nome: string;
  itens: ItemLembrete[];
  appUrl: string;
}) {
  return (
    <EmailLayout
      preview="Uma certificação sua está perto de vencer"
      appUrl={appUrl}
      action={{ label: "Ver minha carteira", href: `${appUrl}/carteira` }}
    >
      <Text style={paragrafo}>Olá, {nome}.</Text>
      {itens.map((i) => (
        <Text key={i.nome} style={paragrafo}>
          <strong>{i.nome}</strong> {quando(i.dias)} ({i.vence}).
        </Text>
      ))}
      <Text style={paragrafo}>
        Para renovar, faça de novo o exame da certificação ou um exame de nível mais alto que a recertifique, conforme
        as regras de recertificação publicadas pela AWS. Você pode desligar estes avisos em Conta, preferências de
        e-mail.
      </Text>
    </EmailLayout>
  );
}
