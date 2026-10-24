import { Text } from "@react-email/components";
import { EmailLayout, paragrafo } from "@/emails/layout";

const usd = (v: number) => `US$ ${v.toFixed(2)}`;

export function EmailAlertaOrcamento({
  mes,
  gastoUsd,
  limiteUsd,
  appUrl,
}: {
  mes: string;
  gastoUsd: number;
  limiteUsd: number;
  appUrl: string;
}) {
  return (
    <EmailLayout preview={`Orçamento de IA de ${mes} atingido`} appUrl={appUrl}>
      <Text style={paragrafo}>
        O gasto estimado com IA em {mes} chegou a {usd(gastoUsd)}, acima do teto de {usd(limiteUsd)}
        (AI_MONTHLY_BUDGET_USD).
      </Text>
      <Text style={paragrafo}>
        A geração de material novo está pausada até o próximo mês. O que já foi gerado continua disponível. Para liberar
        antes, suba o teto nas variáveis de ambiente.
      </Text>
    </EmailLayout>
  );
}

export default function Preview() {
  return <EmailAlertaOrcamento mes="2026-10" gastoUsd={20.4} limiteUsd={20} appUrl="http://localhost:3000" />;
}
