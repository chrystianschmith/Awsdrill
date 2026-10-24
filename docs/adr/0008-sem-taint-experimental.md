# 0008 · Sem `experimental.taint` do React

- **Decisão (2026-10-24):** não ligar `experimental.taint`; diverge de `seguranca-vibecoding` §6, que pede `taintObjectReference`/`taintUniqueValue`.
- **Motivo:** no Next 16.4 a opção troca o `app/` para `react@experimental` em produção, o que conflita com a §4 da mesma skill (versões estáveis e corrigidas de React/Next). O vazamento que o taint evitaria já é barrado por `select` explícito: `getCurrentUser()` devolve só id, nome, e-mail, papel e datas, e nenhum componente cliente recebe objeto do Prisma inteiro.
- **Revisitar:** quando a API de taint chegar ao React estável.
