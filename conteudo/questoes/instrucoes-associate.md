## Nível Associate (opencode-v3)

Este exame é de nível **Associate**: a pessoa já sabe o que cada serviço faz e é cobrada por **escolher a arquitetura**
certa para um cenário. Questão que alguém com o Cloud Practitioner acertaria só pelo nome do serviço não serve.

- Todo enunciado descreve um cenário de arquitetura com **pelo menos duas restrições concorrentes**, por exemplo: menor
  custo × alta disponibilidade, menor esforço operacional × desempenho, RPO/RTO definidos × orçamento, sem mudança de
  código × escalabilidade. Termine com o critério de desempate ("com o MENOR esforço operacional", "da forma MAIS
  econômica", "com a MENOR latência").
- As alternativas são **arquiteturas plausíveis e completas**, todas funcionais em algum grau; só uma atende a todas as
  restrições. Os distratores falham por um motivo técnico concreto (custo maior, ponto único de falha, esforço manual,
  limite do serviço, AZ única), não por serem absurdos.
- Nada de "Qual serviço faz X?" nem de definição. Nada de distrator com serviço sem relação com o problema.
- Use detalhes que mudam a resposta: volume e padrão de acesso, latência exigida, região/AZ, tipo de carga
  (stateful/stateless), frequência de leitura, janela de manutenção, conformidade.
- Na `explicacao`, diga qual restrição cada distrator viola.
