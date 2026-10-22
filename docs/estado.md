# Estado

Atualizado ao fim de cada etapa. Plano aprovado: https://claude.ai/artifact/TRY6YQRyixxPy1ESp4tVWi

## Feito
- **Etapa 1 · Fundação (2026-10-22):** base copiada do Prumo sem o domínio de concursos; tokens (primária azul-marinho),
  layout, início "em construção", 404, erro, offline e PWA; CSP com nonce e headers de segurança em `src/proxy.ts`;
  Sentry opcional por DSN; Prisma 7 com migration inicial vazia; CI com gitleaks, lint, typecheck, testes, build,
  varredura de segredos no bundle, `npm audit` e e2e (375px e 1280px, axe nos temas claro e escuro); Dependabot.
- **Etapa 2 · Auth e conta (2026-10-22):** `src/lib/auth` do Prumo sem apelido nem ranking; cadastro com aceite de
  termos/privacidade versionado, confirmação de e-mail (24h), login com rate limit e tempo igual para e-mail inexistente,
  reset (30 min, uso único, revoga sessões), troca de senha, sessão no banco com expiração deslizante; `/conta` com dados,
  senha, preferências de e-mail, exportar JSON e excluir conta; `/hoje` provisório; termos e privacidade; cron diário de
  limpeza (`/api/cron/limpeza`, exige `CRON_SECRET`). `src/lib/auth/lgpd.ts` + teste que lê o schema e falha se um modelo
  com `userId` não for exportado nem justificado. Testes: unitários, integração no Postgres (`npm run test:integration`,
  inclui IDOR entre dois usuários) e e2e dos fluxos. Next 16.4.0 → 16.4.2 (RCE crítica GHSA-2464-fhr4-w9xw). Semgrep no CI.

## Próximo
- **Etapa 3 · Catálogo de exames** (`pipeline-editais` adaptada, ADR 0002): Certification, ExamVersion, Domain e
  BlueprintWeight; seed de CLF-C02, AIF-C01 e SAA-C03 a partir dos exam guides públicos; páginas públicas por exame.

## Decisões
- `docs/adr/0001` Gemini grátis como IA padrão · `0002` pipeline adaptada a exam guides · `0003` repo separado com base do Prumo.
- Preferências de estudo (meta diária, pomodoro) entram com a etapa de estudo, não na conta.
- Exclusão de conta ainda não cancela assinatura: a etapa 7 (Stripe) entra em `excluirConta` antes de apagar os dados.
- Ranking semanal fora do MVP; Lab só na Fase 3 (sem migration no MVP); prontidão 0–100 com faixa, sem "nota prevista".

## Blockers
- Nome definitivo do produto e domínio (hoje "Trilha", provisório em `src/lib/brand.ts`).
- Infra a criar: projeto Neon (secret `NEON_API_KEY`, variable `NEON_PROJECT_ID` para o banco de preview por PR),
  projeto Vercel, projeto Sentry, produtos no Stripe, domínio no Resend.
- Vercel: definir `CRON_SECRET` (sem ele o cron de limpeza responde 401) e `RESEND_API_KEY` (sem ela os e-mails não saem).
- Semgrep só roda no CI (o semgrep.dev é bloqueado pela rede do ambiente do agente).
- `npm audit` completo mostra 5 altas só em dev (braces via `eslint-config-next`), sem correção publicada; produção limpa.
- Ações do GitHub ainda por tag, não por SHA (`seguranca-vibecoding` §13), igual ao Prumo; fixar quando houver acesso à API.
