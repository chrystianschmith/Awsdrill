import type { Metadata } from "next";
import Link from "next/link";
import { SecaoLegal as Secao } from "@/components/app/secao-legal";
import { VERSAO_TERMOS } from "@/lib/auth/lgpd";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: `Como o ${BRAND.name} trata seus dados pessoais, em linguagem direta.`,
};

export default function PrivacidadePage() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-8 px-4 py-10 sm:px-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Política de privacidade</h1>
        <p className="text-sm text-muted-foreground">
          Versão <span className="tabular">{VERSAO_TERMOS}</span>. Escrita para ser lida de verdade, de acordo com a Lei
          Geral de Proteção de Dados (Lei 13.709/2018).
        </p>
      </header>

      <Secao titulo="Quais dados coletamos">
        <ul className="grid list-disc gap-2 pl-5">
          <li>
            <strong>Cadastro:</strong> nome e e-mail. A senha é guardada apenas como hash (argon2id); ninguém consegue
            lê-la.
          </li>
          <li>
            <strong>Uso da plataforma:</strong> certificações que você estuda, respostas a questões e simulados, revisões
            e a prontidão calculada a partir delas.
          </li>
          <li>
            <strong>Segurança:</strong> endereço IP e navegador usados no login, registros de ações sensíveis (login,
            troca de senha, exclusão de conta) e contadores de tentativas para bloquear abuso.
          </li>
          <li>
            <strong>Assinatura:</strong> situação do plano e datas de cobrança. Os dados do cartão ou do Pix ficam com o
            Stripe; nós não os recebemos.
          </li>
          <li>
            <strong>Aceites:</strong> versão e data em que você aceitou os termos e esta política.
          </li>
        </ul>
        <p>
          Nunca pedimos credenciais da sua conta de nuvem. Não usamos cookies de publicidade nem vendemos dados. O único
          cookie necessário é o de sessão, para manter você logado.
        </p>
      </Secao>

      <Secao titulo="Para que usamos">
        <ul className="grid list-disc gap-2 pl-5">
          <li>Criar e manter sua conta e o seu plano de estudo (execução do contrato).</li>
          <li>Calcular progresso, revisões e prontidão por domínio do exame.</li>
          <li>Enviar e-mails de segurança e, se você permitir, lembretes de revisão e avisos de mudança no exame.</li>
          <li>Proteger a plataforma contra fraude e acesso indevido (legítimo interesse).</li>
          <li>Cumprir obrigações legais, como registros de pagamento.</li>
        </ul>
      </Secao>

      <Secao titulo="Com quem compartilhamos">
        <p>
          Apenas com fornecedores necessários para o serviço funcionar: hospedagem (Vercel), banco de dados (Neon),
          pagamentos (Stripe), envio de e-mails (Resend) e monitoramento de erros (Sentry). As questões geradas por IA
          partem da documentação pública e não usam seus dados pessoais. Seu e-mail nunca aparece para outros usuários.
        </p>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>Você pode, a qualquer momento:</p>
        <ul className="grid list-disc gap-2 pl-5">
          <li>
            <strong>Acessar e levar seus dados:</strong> em{" "}
            <Link href="/conta" className="text-primary underline underline-offset-4">
              Conta
            </Link>
            , use &quot;Baixar meus dados&quot; para receber um arquivo JSON com tudo o que guardamos sobre você.
          </li>
          <li>
            <strong>Corrigir:</strong> o nome pode ser alterado em Conta.
          </li>
          <li>
            <strong>Excluir:</strong> &quot;Excluir conta&quot; apaga seus dados pessoais e de estudo. Registros de
            segurança e de pagamento exigidos por lei ficam sem vínculo com você.
          </li>
          <li>
            <strong>Revogar consentimentos:</strong> desligue os e-mails opcionais em Conta, na seção de notificações.
          </li>
          <li>Pedir informações sobre o tratamento ou reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
        </ul>
      </Secao>

      <Secao titulo="Por quanto tempo guardamos">
        <p>
          Enquanto sua conta existir. Depois da exclusão, os dados pessoais são apagados na hora; cópias de segurança do
          banco são sobrescritas no ciclo normal do provedor.
        </p>
      </Secao>

      <Secao titulo="Contato">
        <p>
          Dúvidas ou pedidos sobre seus dados:{" "}
          <a href={`mailto:${BRAND.supportEmail}`} className="text-primary underline underline-offset-4">
            {BRAND.supportEmail}
          </a>
          . Respondemos em até 15 dias.
        </p>
        <p>
          Veja também os{" "}
          <Link href="/termos" className="text-primary underline underline-offset-4">
            termos de uso
          </Link>
          .
        </p>
      </Secao>
    </div>
  );
}
