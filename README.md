# Trilha · preparação para certificações de nuvem

SaaS em pt-BR que leva uma pessoa do zero até a aprovação em cada certificação de nuvem, com plano pelo blueprint
do exame, simulados por domínio, prontidão medida e recertificação. "Trilha" é um nome provisório (`src/lib/brand.ts`).
Não somos afiliados à Amazon Web Services; nenhuma questão real de prova é usada.

Produto e escopo: [`docs/goal-contexto-aws.md`](docs/goal-contexto-aws.md) · Estado: [`docs/estado.md`](docs/estado.md) ·
Decisões: [`docs/adr/`](docs/adr/).

## Setup local

Requisitos: Node 24 (mínimo 22.12) e PostgreSQL 16 local ou um banco no Neon.

```bash
npm ci
cp .env.example .env          # preencha DATABASE_URL; o resto é opcional no desenvolvimento
npm run db:deploy             # aplica as migrations
npm run dev                   # http://localhost:3000
```

## Testes e verificação

```bash
npm run lint
npm run typecheck
npm test                      # unitários (Vitest), sem banco e sem serviços externos
npm run build
npx prisma validate && npx prisma migrate status
npm run test:e2e              # Playwright: build de produção na porta 3100 com E2E_DATABASE_URL
```

## Custos e serviços

Só serviços já usados no Prumo, nos planos gratuitos (skill `custo-minimo`): Vercel, Neon, GitHub Actions, Resend,
Sentry (sem DSN fica desligado) e Stripe (só taxa por transação). IA: Gemini na camada grátis por padrão, com teto
mensal em `AI_MONTHLY_BUDGET_USD` (`docs/adr/0001-ia-gemini-padrao.md`). A pipeline mensal do catálogo roda no
GitHub Actions e não usa IA (`docs/adr/0005-pipeline-do-catalogo-sem-ia.md`). Nada de Redis, filas, busca ou storage pagos.
