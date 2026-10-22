# 0005 · Pipeline do catálogo lê o Markdown oficial, sem IA

- **Decisão:** a pipeline mensal lê a versão `.md` que a documentação da AWS publica ao lado de cada página do exam guide e extrai código, questões, corte, domínios, pesos e task statements por regras fixas (`src/lib/catalogo/guia.ts`). Sem chamada de IA; o custo é zero (`custo-minimo`).
- **Diferença da `pipeline-editais`:** a skill estrutura com IA porque edital é PDF sem formato; aqui o formato é estável. Mantidos: allowlist e SSRF (§11), robots.txt, User-Agent com contato, confiança calculada por regras (limiar 0,85), fila de moderação e diff entre revisões. Se o formato mudar, a leitura falha, a confiança cai e a coleta vai para a fila; nada é publicado errado.
- **Também:** duração, preço e status vêm da página da certificação e continuam do registro atual; o seed só cria exames que ainda não existem; tarefa que sai do guia fica com `retiredAt`, não é apagada.
