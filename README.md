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

## Banco de questões

Questões entram por arquivo JSON validado (`ArquivoQuestoes` em `src/lib/simulados/schemas.ts`), sempre como pendentes,
e só aparecem nos simulados depois de aprovadas. Toda questão cita ao menos uma fonte oficial; questão real de prova
(dump) é proibida. Até a tela de admin (etapa 8), a moderação é pela linha de comando:

```bash
npx tsx scripts/questoes/importar.ts questoes.json          # valida e importa como pendentes
npx tsx scripts/questoes/importar.ts --pendentes CLF-C02     # lista as pendentes do exame
npx tsx scripts/questoes/importar.ts --aprovar <id> [<id>…]  # publica
npx tsx scripts/questoes/importar.ts --rejeitar <id> --nota "motivo"
```

Os lotes ficam em `conteudo/questoes/<EXAME>/`. Rascunhos com IA saem de `scripts/questoes/opencode-lotes.py` (no Mac,
modelo grátis do OpenCode, sem ferramentas; instruções em `conteudo/questoes/instrucoes.md`), que só grava o que passa
em `scripts/questoes/validar.ts` (formato, códigos do exam guide, duplicatas) e cujas fontes respondem 200. Todo lote é
revisado contra a documentação antes do commit e ainda passa pela moderação ao importar.

## Material com IA

Em `/material/<tarefa>` o usuário pede o resumo, os flashcards e 5 questões da tarefa. A geração (`src/lib/ai/material.ts`)
acontece uma vez por tarefa e fica para todos; um advisory lock do Postgres impede duas gerações simultâneas. A saída
passa pelo schema `MaterialIA` (fontes só https de host oficial) com até 2 rodadas de correção; as questões entram
pendentes pelo mesmo import do banco de questões e só vão aos simulados depois da moderação. O resumo é markdown
restrito, sem HTML nem links (`docs/adr/0006-markdown-restrito.md`). "Reportar erro" cria um `ContentReport`; com mais
de 3 reports abertos, o material sai do ar e é refeito no próximo pedido. Sem `GEMINI_API_KEY` (nem `ANTHROPIC_API_KEY`)
a geração fica desligada. Os testes nunca chamam a IA: `tests/setup/sem-rede.ts` bloqueia qualquer fetch para fora.

## Planos e pagamentos

Grátis × Pro em `src/lib/assinaturas/entitlements.ts`; toda checagem passa por `plano.ts` (`assertEntitlement`,
`limiteDoPlano`) no servidor, e a UI só mostra o convite (`UpgradeCta`). Stripe Checkout hospedado: mensal e anual no
cartão (7 dias grátis na primeira assinatura) e anual via Pix como pagamento único, porque conta Stripe BR não tem Pix
recorrente (`docs/adr/0007-planos-e-pix-anual-avulso.md`). O Pro só é liberado pelo webhook `/api/stripe/webhook`
(assinatura verificada, idempotente por `event.id`), nunca pelo redirect. O cron diário `/api/cron/limpeza` aplica a
carência de 3 dias, o fim do acesso Pix e o lembrete de renovação. Downgrade não apaga nada.

Para configurar: criar no Stripe o produto Pro com os três preços em BRL, preencher `STRIPE_SECRET_KEY`,
`STRIPE_PRICE_MENSAL`, `STRIPE_PRICE_ANUAL`, `STRIPE_PRICE_ANUAL_PIX`, ativar Pix e o portal do cliente, e cadastrar o
endpoint do webhook (eventos `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`,
`invoice.payment_failed`) com o segredo em `STRIPE_WEBHOOK_SECRET`. Nos testes e2e o app fala com um Stripe falso
(`tests/e2e/apoio/stripe-mock.ts`, via `STRIPE_API_BASE`), sem rede.

## Custos e serviços

Só serviços já usados no Prumo, nos planos gratuitos (skill `custo-minimo`): Vercel, Neon, GitHub Actions, Resend,
Sentry (sem DSN fica desligado) e Stripe (só taxa por transação). IA: Gemini na camada grátis por padrão, com teto
mensal em `AI_MONTHLY_BUDGET_USD` (`docs/adr/0001-ia-gemini-padrao.md`): cada chamada grava tokens e custo estimado em
`AiUsageLog`; no teto a geração pausa e `ADMIN_ALERT_EMAIL` recebe um aviso por mês. Por usuário, 10 gerações por hora. A pipeline mensal do catálogo roda no
GitHub Actions e não usa IA (`docs/adr/0005-pipeline-do-catalogo-sem-ia.md`). Nada de Redis, filas, busca ou storage pagos.
