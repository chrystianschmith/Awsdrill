# 0001 · Gemini na camada grátis como IA padrão

- **Decisão (2026-10-21, Chrytian):** Gemini grátis por padrão, Claude Haiku como alternativa; diverge de `custo-minimo`/`pipeline-editais`, que pedem Claude Haiku primeiro.
- **Motivo:** o conteúdo é público e compartilhado entre assinantes, sem dado pessoal no prompt, então a camada grátis cabe e o custo por assinante cai; o Prumo já roda assim.
- **Limites mantidos:** teto `AI_MONTHLY_BUDGET_USD`, custo registrado por chamada, Zod na saída, mock em testes; Opus/Fable nunca dentro do produto.
