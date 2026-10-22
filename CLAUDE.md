# Trilha (nome provisório)

SaaS em pt-BR de preparação para certificações de nuvem. Produto, escopo, fases e fora de escopo: `docs/goal-contexto-aws.md`.
Estado atual e próximo passo: `docs/estado.md` (ler antes de começar; atualizar ao fim de cada etapa). Decisões: `docs/adr/`.

## Regras
As skills da conta têm prioridade sobre escolhas padrão: `assinaturas-planos`, `auth-seguranca`, `custo-minimo`,
`design-system-estudos`, `design-ui-referencias`, `motor-de-estudo`, `pipeline-editais`, `qualidade-entrega`,
`seguranca-vibecoding`. Em conflito com uma skill, seguir a skill e registrar o motivo em `docs/adr/`.
Regras de produto vivem em `docs/` e nas skills; não copiá-las para cá.

## Stack
Next.js 16 (App Router, `src/proxy.ts`), React 19, TypeScript 6 estrito, Prisma 7 (cliente em `src/generated/prisma`,
config em `prisma.config.ts`), Postgres/Neon, Tailwind 4, componentes estilo shadcn em `src/components/ui`, Zod 4,
Vitest, Playwright, Sentry. Base copiada de `chrystianschmith/plataforma_estudos` (Prumo).

## Convenções
- Domínio em `src/lib/*`; regras de negócio em funções puras testadas.
- Server Actions retornam `ActionResult` (`src/lib/errors.ts`); mensagens em pt-BR. Datas em UTC no banco.
- Plano só via `entitlements.ts` (entra na etapa 7). IA nunca é chamada em testes (mock).
- Git: commits pequenos em pt-BR, uma ideia por commit; nunca dois agentes na mesma branch.

## Comandos de pronto
`npm run lint && npm run typecheck && npm test && npm run build`, `npx prisma validate && npx prisma migrate status`,
`npm run test:e2e` quando mexer em fluxo de usuário.
