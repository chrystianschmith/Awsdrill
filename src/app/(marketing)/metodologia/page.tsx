import type { Metadata } from "next";
import { SecaoLegal as Secao } from "@/components/app/secao-legal";
import { BRAND } from "@/lib/brand";
import {
  ALVO_TAREFA,
  JANELA_DIAS,
  MEIA_VIDA_DIAS,
  METODOLOGIA_VERSAO,
  MINIMO_EXAME,
  MINIMO_POR_TAREFA,
} from "@/lib/prontidao/calculo";

export const metadata: Metadata = {
  title: "Metodologia da prontidão",
  description: `Como o ${BRAND.name} calcula a estimativa de prontidão por tarefa, domínio e exame.`,
};

export default function MetodologiaPage() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-8 px-4 py-10 sm:px-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Metodologia da prontidão</h1>
        <p className="text-sm text-muted-foreground">
          Versão <span className="tabular">{METODOLOGIA_VERSAO}</span>. A prontidão é uma estimativa de 0 a 100 do
          quanto você domina o conteúdo do exam guide, calculada só com as questões que você respondeu aqui. Não é nota
          prevista do exame, não usa a escala oficial de pontuação e não garante aprovação.
        </p>
      </header>

      <Secao titulo="1. Por tarefa">
        <p>
          Cada tarefa (task statement) do exam guide vigente recebe o seu percentual de acerto recente. Respostas mais
          antigas valem menos: o peso de uma resposta cai à metade a cada {MEIA_VIDA_DIAS} dias, e respostas com mais de{" "}
          {JANELA_DIAS} dias não entram.
        </p>
        <p>
          Com poucas respostas o acaso pesa muito, então até {MINIMO_POR_TAREFA} respostas equivalentes as que faltam
          contam como erro. Um único acerto vale {Math.round(100 / MINIMO_POR_TAREFA)}, não 100. A tarefa só conta como
          coberta a partir de {MINIMO_POR_TAREFA} respostas.
        </p>
        <p>
          A faixa em volta do número é o intervalo de Wilson de 95%: com poucas respostas ela é larga, e estreita
          conforme você responde mais. Questões ligadas ao domínio inteiro valem para todas as tarefas dele em partes
          iguais.
        </p>
      </Secao>

      <Secao titulo="2. Por domínio">
        <p>
          A prontidão do domínio é a média das suas tarefas. Tarefa sem resposta entra como 0, com faixa de 0 a 100: não
          dá para estar pronto no que ainda não foi medido. A cobertura do domínio é a fração de tarefas cobertas.
        </p>
      </Secao>

      <Secao titulo="3. Por exame">
        <p>
          A prontidão do exame é a média dos domínios ponderada pelo peso oficial de cada um no exam guide vigente. Se
          um peso ainda está a confirmar, usamos a média dos pesos conhecidos. Com menos de {MINIMO_EXAME} respostas, a
          estimativa aparece marcada como amostra pequena.
        </p>
        <p>
          Por construção, acertar mais uma questão nunca baixa a estimativa e errar nunca a sobe. Quando o exam guide
          muda, as respostas continuam valendo para o domínio, e as tarefas novas entram sem cobertura.
        </p>
      </Secao>

      <Secao titulo="4. Plano de correção">
        <p>
          Listamos até cinco tarefas sem respostas, com poucas respostas ou com acerto abaixo de {ALVO_TAREFA}, das que
          mais pesam no exame para as que menos pesam (peso do domínio × o que falta para 100, dividido pelo número de
          tarefas do domínio).
        </p>
      </Secao>

      <Secao titulo="5. Limites">
        <p>
          As questões são nossas, escritas a partir da documentação pública; nenhuma é questão real de prova. Ir bem
          aqui indica domínio do conteúdo, mas o exame oficial tem formato, banco e escala próprios. Ao encerrar cada
          simulado guardamos uma foto da estimativa com a versão desta metodologia; se a regra mudar, a versão muda.
        </p>
      </Secao>
    </div>
  );
}
