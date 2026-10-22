import type { Metadata } from "next";
import Link from "next/link";
import { SecaoLegal as Secao } from "@/components/app/secao-legal";
import { VERSAO_TERMOS } from "@/lib/auth/lgpd";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: `Regras de uso do ${BRAND.name}, em linguagem direta.`,
};

export default function TermosPage() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-8 px-4 py-10 sm:px-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Termos de uso</h1>
        <p className="text-sm text-muted-foreground">
          Versão <span className="tabular">{VERSAO_TERMOS}</span>. Ao criar uma conta, você concorda com estes termos e
          com a{" "}
          <Link href="/privacidade" className="text-primary underline underline-offset-4">
            política de privacidade
          </Link>
          .
        </p>
      </header>

      <Secao titulo="O que é o serviço">
        <p>
          O {BRAND.name} é uma ferramenta de preparação para certificações de nuvem: organiza o estudo pelos domínios e
          pesos do guia oficial de cada exame, oferece simulados e mostra uma estimativa de prontidão. Não somos afiliados
          à Amazon Web Services nem a qualquer provedor de nuvem, não emitimos certificações, não vendemos vouchers e não
          garantimos aprovação.
        </p>
      </Secao>

      <Secao titulo="Questões e conteúdo gerado por IA">
        <p>
          As questões são autorais, escritas a partir da documentação pública, e parte delas é gerada com ajuda de
          inteligência artificial e revisada antes de publicar. Não usamos questões reais de prova. Pode haver erros: a
          documentação oficial do provedor e o guia do exame são sempre a referência. Se encontrar um erro, use
          &quot;reportar erro&quot; na própria questão.
        </p>
      </Secao>

      <Secao titulo="Prontidão">
        <p>
          A prontidão é uma estimativa calculada a partir das suas respostas, com metodologia publicada. Ela ajuda a
          decidir quando marcar a prova, mas não prevê a nota nem garante o resultado.
        </p>
      </Secao>

      <Secao titulo="Sua conta">
        <ul className="grid list-disc gap-2 pl-5">
          <li>Você é responsável por manter sua senha em segredo e por informar um e-mail que seja seu.</li>
          <li>Nunca pedimos credenciais da sua conta de nuvem. Não as informe em nenhum campo do serviço.</li>
          <li>
            É proibido copiar o banco de questões em massa, usar automação, tentar acessar dados de outras pessoas ou
            sobrecarregar o serviço. Podemos suspender contas que fizerem isso.
          </li>
        </ul>
      </Secao>

      <Secao titulo="Planos e pagamento">
        <p>
          Os planos pagos e seus preços serão exibidos antes de qualquer cobrança, que acontece pelo Stripe. Você poderá
          cancelar quando quiser; compras online podem ser canceladas em até 7 dias com reembolso integral, conforme o
          Código de Defesa do Consumidor.
        </p>
      </Secao>

      <Secao titulo="Encerramento">
        <p>
          Você pode excluir sua conta a qualquer momento em Conta. Se precisarmos encerrar o serviço, avisaremos com pelo
          menos 30 dias de antecedência e você poderá exportar seus dados.
        </p>
      </Secao>

      <Secao titulo="Mudanças nestes termos">
        <p>
          Quando houver mudança relevante, avisaremos por e-mail ou no aplicativo e pediremos um novo aceite. A versão em
          vigor fica sempre nesta página.
        </p>
      </Secao>

      <Secao titulo="Contato">
        <p>
          Fale com a gente em{" "}
          <a href={`mailto:${BRAND.supportEmail}`} className="text-primary underline underline-offset-4">
            {BRAND.supportEmail}
          </a>
          . Fica eleito o foro do domicílio do consumidor.
        </p>
      </Secao>
    </div>
  );
}
