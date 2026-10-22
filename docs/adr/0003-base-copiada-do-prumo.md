# 0003 · Repo separado com a base do Prumo

- **Decisão:** repo próprio (`aws-saas`), histórico limpo, copiando do Prumo só infraestrutura (configs, CSP, design system, Sentry, CI); módulos de conta, planos e IA são trazidos na etapa em que entram.
- **Motivo:** domínio sem tabelas em comum (editais × exames), Stripe/preços/deploy/custo de IA isolados, e nenhum risco de regressão no Prumo.
- **Diferenças visíveis:** nome provisório "Trilha" (sem "AWS", regra do produto), primária azul-marinho e novo símbolo, cookie `tr_sessao`.
