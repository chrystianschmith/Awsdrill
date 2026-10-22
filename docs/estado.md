# Estado

Atualizado ao fim de cada etapa. Plano aprovado: https://claude.ai/artifact/TRY6YQRyixxPy1ESp4tVWi

## Feito
- **Etapa 1 · Fundação (2026-10-22):** base copiada do Prumo sem o domínio de concursos; tokens (primária azul-marinho),
  layout, início "em construção", 404, erro, offline e PWA; CSP com nonce e headers de segurança em `src/proxy.ts`;
  Sentry opcional por DSN; Prisma 7 com migration inicial vazia; CI com gitleaks, lint, typecheck, testes, build,
  varredura de segredos no bundle, `npm audit` e e2e (375px e 1280px, axe nos temas claro e escuro); Dependabot.

## Próximo
- **Etapa 2 · Auth e conta** (`auth-seguranca`): trazer `src/lib/auth` e telas de conta do Prumo; cadastro, confirmação,
  login, reset, sessão revogável, rate limit, preferências, exportar e excluir dados (LGPD).

## Decisões
- `docs/adr/0001` Gemini grátis como IA padrão · `0002` pipeline adaptada a exam guides · `0003` repo separado com base do Prumo.
- Ranking semanal fora do MVP; Lab só na Fase 3 (sem migration no MVP); prontidão 0–100 com faixa, sem "nota prevista".

## Blockers
- Nome definitivo do produto e domínio (hoje "Trilha", provisório em `src/lib/brand.ts`).
- Infra a criar: projeto Neon (secret `NEON_API_KEY`, variable `NEON_PROJECT_ID` para o banco de preview por PR),
  projeto Vercel, projeto Sentry, produtos no Stripe, domínio no Resend.
- Ações do GitHub ainda por tag, não por SHA (`seguranca-vibecoding` §13), igual ao Prumo; fixar quando houver acesso à API.
