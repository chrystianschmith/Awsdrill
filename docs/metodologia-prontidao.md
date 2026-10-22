# Metodologia da prontidão (versão 1.0)

Fonte da regra: `src/lib/prontidao/calculo.ts` (`METODOLOGIA_VERSAO`), testada em `tests/unit/prontidao/calculo.test.ts`.
Texto para o usuário: `/metodologia`. Mudou a regra, suba `METODOLOGIA_VERSAO` e atualize este arquivo e a página; fotos antigas (`ReadinessScore`)
guardam a versão com que foram calculadas.

## Entradas
- Respostas do usuário (`Answer`) dos últimos 180 dias nos domínios vigentes do exame: domínio, tarefa, acerto, data.
- Blueprint vigente: domínios com peso efetivo (`pesosEfetivos`: "a confirmar" usa a média dos conhecidos) e tarefas
  não aposentadas.

## Cálculo
1. **Peso da resposta:** `w = 0,5^(idade_em_dias / 30)`.
2. **Destino:** resposta ligada a uma tarefa vigente vai para ela; ligada só ao domínio (ou a tarefa aposentada) vale
   `w / k` em cada uma das `k` tarefas do domínio; domínio sem tarefas é a própria folha.
3. **Tarefa:** `n_ef = Σw`, `a = Σw·acerto`, `n = max(n_ef, 3)`. Escore `a / n`; limite inferior = Wilson 95% de
   `(a, n)`; superior = Wilson 95% de `(a + n − n_ef, n)`. Coberta com 3 ou mais respostas contadas.
4. **Domínio:** média simples das tarefas (sem resposta = 0, faixa 0–100). Cobertura = tarefas cobertas / tarefas.
5. **Exame:** média dos domínios ponderada pelo peso efetivo (escore, limites e cobertura). Amostra pequena abaixo de
   20 respostas. Exibição 0–100 arredondada, sempre com a faixa e o rótulo "estimativa".
6. **Plano de correção:** tarefas sem respostas, com menos de 3 ou com escore < 70, ordenadas por
   `peso_domínio × (100 − escore) / 100 / nº de tarefas do domínio`; até 5.
7. **Ciclo de estudos:** a taxa de acerto do fator de desempenho é `a / n_ef` por domínio (sem o mínimo de 3); domínio
   sem respostas fica com fator 1.

## Propriedades garantidas por teste
- Mais um acerto nunca baixa o escore nem o limite inferior; mais um erro nunca os sobe (300 casos aleatórios).
- Faixa sempre contém o escore e estreita com a amostra; tarefa sem resposta puxa o exame para baixo.

## Decisões
- Sem "nota prevista 100–1000": a escala oficial não é linear nem pública, e o banco é próprio.
- Pseudo-amostra de 3 em vez de esconder o escore: mantém a monotonia e penaliza amostra pequena sem saltos.
- Foto gravada ao encerrar simulado (não a cada resposta) para o histórico; a tela calcula na hora (consulta indexada
  por `userId, domainId, answeredAt`).
