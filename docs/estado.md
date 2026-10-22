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

- **Etapa 3a · Catálogo (2026-10-22):** Certification, ExamVersion, Domain (domínio → task statement) e BlueprintWeight
  por revisão; `src/lib/catalogo` com schema Zod do exame coletado (fontes só de `docs.aws.amazon.com`/`aws.amazon.com`),
  regras puras (soma de pesos, "a confirmar", publicação por completude, hash do blueprint, revisões, conjunto Golden
  Jacket por status e data, ordem da trilha) e `aplicarExame` idempotente; seed de CLF-C02, AIF-C01 e SAA-C03 com dados
  lidos das fontes oficiais em 2026-10-22 (`prisma/catalogo/exames.ts`); páginas `/certificacoes` e
  `/certificacoes/[slug]`; início lendo o catálogo do banco. ADR 0004.
- **Etapa 3b · Pipeline do catálogo (2026-10-22):** `.github/workflows/pipeline-catalogo.yml` (mensal + manual) roda
  `scripts/pipeline/catalogo.ts`: coletor com allowlist de host exato, só https, bloqueio de IP interno, redirects
  revalidados (máx. 3), limite de 2 MB, robots.txt e User-Agent com contato; leitura determinística da versão `.md` do
  exam guide (`guia.ts`, sem IA, ADR 0005); diff entre gravado e coletado; confiança por regras (limiar 0,85); publica
  pelo mesmo `aplicarExame` ou põe na fila `CatalogReview` (aprovar/rejeitar pelo workflow até a tela de admin);
  execuções em `CatalogRun`. Tarefa que sai do guia fica com `retiredAt`. Seed só cria exame que ainda não existe.
- **Etapa 4a · Estudo (2026-10-22):** seguir exame (`UserExam`, com data da prova); sessões controladas pelo servidor
  (`StudySession`/`StudyPause`) por exame, domínio e tarefa opcional, modos livre, Pomodoro e foco; uma ativa por usuário
  (índice parcial único), sem sobreposição, 4h por sessão (encerra e pede o tempo real), 4h por lançamento manual, 16h
  por dia; meta diária e streak configuráveis; status por tarefa (`UserTopic`) e progresso do exame ponderado pelos pesos
  do blueprint (peso "a confirmar" usa a média dos conhecidos). Telas `/hoje`, `/estudar`, `/progresso` e `/exames`.
  `src/lib/estudo/{tempo,sessoes,metas}` vêm do Prumo; `progresso.ts` é novo. LGPD exporta os três modelos novos.
  Testes: unitários, integração (IDOR, limites, pausas, auto-encerramento) e e2e (seguir → timer → progresso → Hoje).

## Próximo
- **Etapa 4b · Estudo:** ciclo de estudos (distribuição por peso do blueprint × desempenho) e revisão espaçada
  1/7/30 com revisões vencidas no "Hoje" (`motor-de-estudo`).
- Tela da fila de moderação do catálogo entra com o admin (etapa 8).

## Decisões
- `docs/adr/0001` Gemini grátis como IA padrão · `0002` pipeline adaptada a exam guides · `0003` repo separado com base do Prumo
  · `0004` hash do blueprint e etapa 3 em duas partes · `0005` pipeline do catálogo lê o Markdown oficial, sem IA.
- Datas de lançamento e aposentadoria das versões ficam nulas até a fonte oficial anunciar (hoje só há aposentadoria de
  idiomas, que não muda o exame).
- Preferências de estudo (meta diária, pomodoro) ficam no `User` e são editadas em `/hoje` e `/estudar`, não na conta.
- Etapa 4 em duas partes: 4a (sessões, metas, progresso) e 4b (ciclo e revisões). Ciclo e revisões são Pro pela skill,
  mas o bloqueio por plano só entra com `entitlements.ts` na etapa 7; até lá ficam abertos.
- "Matéria" da skill = domínio do exam guide; "tópico" = task statement. Modo "ciclo" do timer entra com a 4b.
- Exclusão de conta ainda não cancela assinatura: a etapa 7 (Stripe) entra em `excluirConta` antes de apagar os dados.
- Ranking semanal fora do MVP; Lab só na Fase 3 (sem migration no MVP); prontidão 0–100 com faixa, sem "nota prevista".

## Blockers
- Nome definitivo do produto e domínio (hoje "Trilha", provisório em `src/lib/brand.ts`).
- Infra a criar: projeto Neon (secret `NEON_API_KEY`, variable `NEON_PROJECT_ID` para o banco de preview por PR),
  projeto Vercel, projeto Sentry, produtos no Stripe, domínio no Resend.
- GitHub: secrets `PIPELINE_CONTACT_EMAIL` (sem ele a pipeline do catálogo falha) e `DATABASE_URL` (sem ele a execução
  mensal só lê e compara com o seed). A coleta real nunca rodou daqui: a rede do agente bloqueia docs.aws.amazon.com;
  o parser foi validado com trechos dos guias lidos em 2026-10-22 (`tests/fixtures/exam-guides`).
- Vercel: definir `CRON_SECRET` (sem ele o cron de limpeza responde 401) e `RESEND_API_KEY` (sem ela os e-mails não saem).
- Semgrep só roda no CI (o semgrep.dev é bloqueado pela rede do ambiente do agente).
- `npm audit` completo mostra 5 altas só em dev (braces via `eslint-config-next`), sem correção publicada; produção limpa.
- Ações do GitHub ainda por tag, não por SHA (`seguranca-vibecoding` §13), igual ao Prumo; fixar quando houver acesso à API.
