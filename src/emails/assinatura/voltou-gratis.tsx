import { Text } from "@react-email/components";
import { EmailLayout, paragrafo } from "@/emails/layout";

export const assuntoVoltouGratis = "Sua conta voltou ao plano Grátis";

/** Assinatura cancelada ou acesso encerrado: a conta voltou ao Grátis sem perder dados. */
export default function VoltouGratisEmail({ nome, appUrl }: { nome: string; appUrl: string }) {
  return (
    <EmailLayout preview="Sua conta voltou ao plano Grátis" appUrl={appUrl} action={{ label: "Ver planos", href: `${appUrl}/precos` }}>
      <Text style={paragrafo}>Olá, {nome}.</Text>
      <Text style={paragrafo}>
        Sua assinatura Pro terminou e a conta voltou ao plano Grátis. Nenhum dado foi apagado: histórico, simulados e
        progresso continuam salvos.
      </Text>
      <Text style={paragrafo}>
        Os exames além do primeiro ficaram pausados e os recursos Pro estão bloqueados. Se assinar de novo, tudo volta
        como estava.
      </Text>
    </EmailLayout>
  );
}
