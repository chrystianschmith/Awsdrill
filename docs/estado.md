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
- **Etapa 4b · Ciclo e revisões (2026-10-22):** ciclo de estudos por exame (`StudyCycle`/`StudyCycleDomain`, um aberto
  por usuário): o usuário escolhe domínios e horas, a carga segue o peso efetivo do blueprint (mín. 30 min; fator de
  desempenho 1 até haver simulados), o feito é recalculado das sessões registradas depois do início e, cumprido, abre
  o próximo ciclo; modo "Ciclo" no timer e "Próximo do ciclo" no Hoje. Revisão espaçada (`Review`, uma pendente por
  tarefa): concluir agenda +1 dia, boa avança para +7/+30, difícil volta para +1 e marca "Revisar"; vencidas no Hoje e
  em `/revisoes`, da mais atrasada. Deixar de seguir encerra o ciclo e esconde as revisões. LGPD exporta os dois.
- **Etapa 5a · Simulados (2026-10-22):** banco de questões (`Question`) importado por JSON validado com Zod
  (fonte oficial obrigatória, hash de conteúdo contra duplicata) e moderado por `scripts/questoes/importar.ts`; só
  questão publicada entra no sorteio. Sorteio ponderado pelo peso efetivo do blueprint (cotas com teto pelo banco e
  maior resto), questões ainda não vistas primeiro. Modo treino (10/20/30, filtro por domínio, gabarito, explicação e
  links oficiais logo após responder) e modo prova (tamanho e duração oficiais, prazo e correção no servidor, troca de
  resposta até enviar, resposta fora do prazo recusada). Gabarito fora do DTO até a resposta (treino) ou o fim (prova).
  Relatório por domínio salvo no `MockAttempt`. Telas `/simulados`, execução e relatório. LGPD exporta tentativas e
  respostas. Testes: unitários (distribuição, correção, prazo), integração (IDOR, gabarito oculto, prazo expirado) e
  e2e (prova completa → relatório; treino com feedback).

- **Etapa 5b · Prontidão (2026-10-22):** `src/lib/prontidao/calculo.ts` puro (versão 1.0): acerto por tarefa com
  decaimento (meia-vida 30 dias, janela 180), mínimo de 3 respostas equivalentes (as que faltam contam como erro),
  faixa de Wilson 95%, domínio = média das tarefas, exame = média ponderada pelo peso efetivo; plano de correção (até 5
  tarefas por peso × o que falta). Foto `ReadinessScore` (exame e domínios) ao encerrar cada simulado. Tela
  `/prontidao` (estimativa com faixa, cobertura, amostra pequena, plano com atalhos para estudar e treinar o domínio,
  histórico) e `/metodologia` pública; `docs/metodologia-prontidao.md`. O acerto recente por domínio passa a alimentar o
  fator de desempenho do ciclo. LGPD exporta as fotos. Testes: unitários (monotonia em 300 casos, amostra pequena,
  cobertura, decaimento), integração (foto, isolamento por usuário, ciclo) e e2e (prova → relatório → prontidão).
- **Banco inicial de questões · CLF-C02 (2026-10-23):** 165 questões (133 SINGLE, 32 MULTIPLE) em
  `conteudo/questoes/CLF-C02/`, de 5 a 10 por tarefa, escritas pelo OpenCode (modelo grátis) com
  `scripts/questoes/opencode-lotes.py` e revisadas uma a uma contra a documentação (185 escritas, 20 descartadas por
  serviço fechado a novos clientes, repetição, tarefa errada ou gabarito errado; 5 corrigidas). Todas importam sem
  erro; entram pendentes e só aparecem depois de `--aprovar`.

- **Etapa 6 · Material com IA (2026-10-24):** `/material/<tarefa>` com resumo, 5 a 10 flashcards e 5 questões por task
  statement, gerados uma vez sob demanda e compartilhados (advisory lock por tarefa). Camada de IA do Prumo em
  `src/lib/ai` (Gemini grátis, Claude como alternativa, `max_tokens`, instruções cacheadas, dados delimitados contra
  prompt injection); saída validada por Zod com fontes só de host oficial; questões entram pendentes pelo import da 5a.
  Teto `AI_MONTHLY_BUDGET_USD` com alerta ao admin, custo por chamada em `AiUsageLog`, 10 gerações/hora por usuário.
  Selo "Gerado por IA", fontes oficiais, "reportar erro" (`ContentReport`; acima de 3 abertos o material sai do ar e é
  refeito). Markdown restrito sem HTML (ADR 0006). Links "Material" no progresso e no plano da prontidão. LGPD exporta
  os reports. Testes: unitários (schema, correção, recusa, teto, custo, markdown, prompt injection, rede bloqueada em
  toda a suíte), integração (geração única com duas requisições simultâneas, teto antes da chamada, saída inválida não
  grava, IDOR, reports) e e2e (tela, selo, texto escapado, report, 404 para quem não segue).

- **Etapa 7 · Planos e Stripe (2026-10-24):** assinaturas do Prumo adaptadas (`src/lib/assinaturas`): Grátis com 1
  exame seguido, 5 treinos por semana e prontidão geral; Pro com modo prova, prontidão por domínio e plano de correção,
  material com IA, ciclo e revisão espaçada (ADR 0007). Checagem no servidor em cada serviço (exames com advisory lock,
  treinos contados na transação) e `UpgradeCta` nas telas; Hoje esconde ciclo e revisões no Grátis. Checkout hospedado
  mensal/anual no cartão e anual Pix avulso, webhook assinado e idempotente (`StripeEvent`), carência de 3 dias,
  lembrete do Pix e downgrade sem perda (exame extra `PAUSADO`, "Retomar" ao voltar) no cron diário de limpeza.
  `/precos` em BRL com FAQ, `/conta/assinatura` com portal e faturas, links no menu e no topo do site. Excluir conta
  cancela a assinatura no Stripe antes de apagar; LGPD exporta a assinatura (sem ids do Stripe). Testes: unitários
  (plano efetivo por linha da tabela, webhook repetido sem efeito duplo, carência, e-mails, funil), integração (limites
  do Grátis, dois "seguir" simultâneos, downgrade e retorno) e e2e com Stripe falso (limite → assina → Pro → cancela →
  Grátis sem perder dados).

## Próximo

- **Etapa 8 · Carteira, admin e métricas.**
- Flashcards no agendador de revisão (acertei/errei) e fila de reports e de questões geradas na tela de admin (etapa 8).
- Para ligar a geração em produção: `GEMINI_API_KEY` e `ADMIN_ALERT_EMAIL` na Vercel (decisão do Chrytian).
- Teste ponta a ponta em Stripe test mode real (com Stripe CLI) quando houver conta; o Pix anual não tem e2e.

## Decisões

- `docs/adr/0001` Gemini grátis como IA padrão · `0002` pipeline adaptada a exam guides · `0003` repo separado com base do Prumo
  · `0004` hash do blueprint e etapa 3 em duas partes · `0005` pipeline do catálogo lê o Markdown oficial, sem IA · `0006` markdown restrito no conteúdo de IA
  · `0007` Grátis × Pro do produto e Pix só no anual avulso.
- Datas de lançamento e aposentadoria das versões ficam nulas até a fonte oficial anunciar (hoje só há aposentadoria de
  idiomas, que não muda o exame).
- Preferências de estudo (meta diária, pomodoro) ficam no `User` e são editadas em `/hoje` e `/estudar`, não na conta.
- Etapa 4 em duas partes: 4a (sessões, metas, progresso) e 4b (ciclo e revisões).
- "Matéria" da skill = domínio do exam guide; "tópico" = task statement.
- Material com IA é gerado por um botão na primeira visita, não ao abrir a página: prefetch e robôs não gastam IA.
- Feito do ciclo é recalculado das sessões (não somado por delta), para não divergir ao excluir ou confirmar sessões.
- Simulados: um em andamento por usuário (começar outro encerra o anterior com o que foi respondido); questão não
  respondida conta como errada; prova com banco menor que o oficial usa o banco todo. Treino fica no Grátis (com limite
  semanal) para o produto ser útil sem assinar; modo prova é Pro. Moderação de questões pela CLI até o admin (etapa 8).
- Prontidão: penalidade de amostra pequena por pseudo-amostra (3) em vez de esconder o número, para manter a
  monotonia; tela calcula na hora e a foto serve ao histórico (`docs/metodologia-prontidao.md`).
- Ranking semanal fora do MVP; Lab só na Fase 3 (sem migration no MVP); prontidão 0–100 com faixa, sem "nota prevista".

## Blockers

- Banco de questões em `conteudo/questoes/` (CLF-C02, AIF-C01 e SAA-C03 já com rodadas revisadas); 30 questões do
  SAA-C03 da rodada 3 estão no Mac sem commit (branch `questoes/saa-rodada-3` a abrir). Questões de 4.3 do CLF-C02
  citam os planos de suporte atuais: conferir na moderação se o exame ainda cobra Developer/Business.
- Preços do Pro (R$ 29,90 / R$ 239,00) aguardam a confirmação do Chrytian; mudar só em `src/lib/assinaturas/precos.ts`.
- Stripe: criar o produto Pro e os três preços, ativar Pix e o portal, cadastrar o webhook e as variáveis `STRIPE_*`.
- Sem banco de produção (Neon), a importação e a moderação só rodam no Postgres local.
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
