# [Nome do produto] — plataforma SaaS de preparação para certificações AWS

> Descrição de projeto (v2). Versão original: "criar uma plataforma SaaS, com as integrações que possuímos hoje,
> para estudo da AWS Practitioner, Architect e todas as outras certificações que englobam para a Golden Jacket."

## 0. Descrição curta (campo de descrição do projeto)

SaaS de preparação para as certificações AWS, do **Cloud Practitioner** até o conjunto completo exigido para a
**Golden Jacket**, reaproveitando a stack e as integrações já em produção na plataforma de concursos (Prumo):
Next.js 16 + React 19 + Prisma/Neon, Stripe (cartão e Pix), Resend, IA com teto de custo, admin, PWA e LGPD.
Interface em pt-BR, valores em BRL, conteúdo técnico com os nomes de serviços em inglês.

## 1. Objetivo

Levar um candidato do zero até a aprovação em **cada certificação AWS**, com plano de estudo orientado ao blueprint
oficial do exame, medição objetiva de prontidão e rotina mantida por meses — e, no limite, cobrir **todas as
certificações ativas** na ordem que leva à Golden Jacket.

Contexto que orienta o produto: a AWS concede a Golden Jacket a quem obtém **todas as certificações ativas**
(hoje 12 exames; o número muda conforme exames entram, entram em beta e são aposentados — p.ex. Advanced Networking
aposenta em 31/12/2026). Logo, o produto **não pode hard-codar** uma lista fixa: o catálogo é dado versionado.

## 2. Público e problema

- Profissional brasileiro de TI/cloud, iniciante a sênior, que estuda sozinho e paga em real por conteúdo que só
  existe em dólar.
- Dores reais: excesso de material disperso, falta de plano com prazo, nenhuma medida de "estou pronto ou não",
  dificuldade de manter constância por 2–4 meses, e a obrigação de recertificar a cada 3 anos.
- Objetivo de negócio: assinatura mensal/anual acessível em BRL, com custo de IA por assinante controlado.

## 3. Escopo funcional

### 3.1 Catálogo de certificações (dado, não código)

Uma entidade por **versão de exame** (ex.: `CLF-C02`, `AIF-C01`, `SAA-C03`, `DVA-C02`, `SOA-C02`, `DEA-C01`,
`MLA-C01`, `SAP-C02`, `DOP-C02`, `SCS-C02`, `ANS-C01`, `AIBIZ-BETA`), com: nível, domínios e **pesos** do blueprint,
nº de questões, duração, nota de corte (escala 100–1000), preço em USD, validade (3 anos), status (ativo, beta,
aposentando, aposentado), datas e links das fontes oficiais.

- Trilhas sugeridas: Foundational → Associate → Professional → Specialty, cada uma com ordem recomendada.
- **Trilha Golden Jacket**: visão de progresso até todas as certificações ativas, com o que falta e em que ordem.
- Mudança de blueprint/versão e aposentadoria geram **alerta** para quem está estudando aquele exame.

### 3.2 Motor de estudo (herdado do Prumo)

Sessões e timer no servidor (livre, Pomodoro, modo foco), metas, streak, ciclo de estudos, progresso ponderado,
revisão espaçada 1/7/30, histórico com heatmap, ranking semanal com fechamento por cron e regras antitrapaça.

### 3.3 Simulados e prontidão

- Banco de questões **próprio**, organizado por domínio e subdomínio do blueprint, ponderado pela distribuição oficial.
- Modo treino (feedback imediato, explicação, link para a documentação oficial) e modo prova (tempo real, sem feedback,
  relatório final por domínio).
- **Readiness score** por domínio e por exame, calculado a partir de acertos recentes, cobertura do blueprint e tempo
  de resposta — o número que responde "marco a prova ou não?".
- Plano de correção: listas geradas a partir dos domínios fracos.

### 3.4 Conteúdo por tópico gerado por IA

Resumo, flashcards e questões gerados sob demanda no primeiro acesso e compartilhados entre todos os assinantes, com
citação da fonte oficial, marca de "gerado por IA" e revisão na fila de moderação. Mesmo desenho de custo do Prumo:
modelo barato/grátis por padrão, prompt caching, Batch API, teto mensal e log de custo por chamada.

### 3.5 Carteira de certificações e recertificação

Registro de aprovado/reprovado e data, "cofre" com badges obtidos, validade de 3 anos, contagem regressiva e e-mail
de recertificação. É o que transforma o produto em relação de longo prazo, não em cursinho pontual.

### 3.6 Prática guiada (mão na massa)

Roteiros de laboratório no **free tier**, com passo a passo, custo esperado, checklist e limpeza de recursos. No MVP
a plataforma **não** acessa a conta AWS do usuário (nenhuma credencial é solicitada ou armazenada).

### 3.7 Conta, planos e admin

Cadastro/login/recuperação, preferências e notificações, exportar e excluir dados (LGPD), planos Grátis e Pro via
`entitlements.ts`, checkout/portal do Stripe, e admin com moderação, fontes, jobs, custo de IA, reports e métricas
(usuários, assinantes, MRR, churn, taxa de aprovação autorrelatada).

## 4. Integrações que já temos (reuso direto, sem contratar nada novo)

| Integração | Como entra neste produto |
| --- | --- |
| Next.js 16 (App Router) + React 19 + TS 6 estrito + Tailwind 4 | Mesma base e design system; novas rotas em pt-BR (`/certificacoes`, `/simulados`, `/prontidao`, `/carteira`) |
| Prisma 7 + Postgres/Neon | Novos modelos (ExamVersion, Domain, Question, MockAttempt, ReadinessScore, Certification); branch de preview por PR |
| Stripe (cartão + Pix anual avulso, portal, webhook assinado idempotente, carência de 3 dias) | Mesma estrutura de assinatura; preços em BRL |
| Resend + React Email | Confirmação de conta, reset, avisos de pagamento e **um** e-mail diário agrupado (revisões, mudança de blueprint, renovação) |
| IA (Gemini na camada grátis por padrão; Claude como alternativa/fallback) | Geração de resumo/flashcards/questões e conferência factual, com teto de gasto e auditoria por chamada |
| Vercel + crons (ranking, carência, limpeza, digest) | Mesmos jobs leves; pipeline de catálogo roda no GitHub Actions |
| GitHub Actions | Pipeline mensal do catálogo AWS: coletar, extrair, versionar com diff, publicar por confiança, moderar o resto |
| Sentry, CI de lint/typecheck/testes/build, Playwright, PWA instalável | Sem alteração |
| Auth própria (argon2id, sessão revogável, rate limit) e CSP/headers | Sem alteração |

## 5. Regras que não mudam (herdadas e obrigatórias)

- Plano só via `entitlements.ts`/`assertEntitlement`; nunca `plan === "PRO"` espalhado.
- Sessão revalidada no servidor em toda página, action e rota; Zod em toda entrada; `ActionResult` com mensagens pt-BR.
- Datas em UTC no banco; dia/semana por `tempo.ts`; valores em BRL, fuso America/Sao_Paulo.
- IA nunca é chamada em teste (mock); custo no mínimo: camada grátis primeiro, conteúdo gerado sob demanda e cacheado,
  sem armazenar PDF/mídia (só link, hash e texto).
- Auditoria de segurança (`seguranca-vibecoding`) antes de cada deploy; LGPD (exportar/excluir) desde o MVP.

## 6. O que muda em relação ao Prumo

| Prumo (concursos) | Este produto (AWS) |
| --- | --- |
| Editais de bancas, pipeline diário com OCR | **Exam guides/blueprints** da AWS, pipeline mensal sem OCR |
| Matérias e tópicos de edital | Domínios e subdomínios do blueprint, com pesos |
| Questões de banca | Banco próprio ponderado pelo blueprint + modo prova real |
| Aprovação pontual | **Readiness score**, prazo de prova e **recertificação a cada 3 anos** |
| Sem gamificação de credencial | Carteira de certificações, progresso até a **Golden Jacket** |

## 7. Fora de escopo (MVP e, alguns, sempre)

- Não somos afiliados, parceiros nem revendedores da AWS; **não** emitimos certificação nem vendemos vouchers.
- **Não** usar "AWS Certified" em nome de produto, domínio ou logo; usar marca neutra e apenas referências factuais.
- **Nunca** copiar questões reais (dumps): banco próprio, derivado de conteúdo público e do blueprint.
- Não guardar credenciais AWS; não executar nada na conta do usuário.
- Não prometer aprovação; prontidão é estimativa estatística, com metodologia publicada.

## 8. Métricas de sucesso

Ativação (cadastro → primeiro simulado em 24 h), retenção D7/D30, questões respondidas por semana, % de assinantes que
marcam prova com prontidão ≥ limiar definido, aprovação autorrelatada por exame, conversão Grátis→Pro, churn,
custo de IA por assinante como fração do MRR, p95 das páginas principais.

## 9. Fases

1. **MVP:** Cloud Practitioner + AI Practitioner + Solutions Architect Associate; motor de estudo, banco de questões
   por domínio, simulado com relatório, prontidão, planos/checkout, admin e carteira.
2. **Cobertura Associate + Professional:** Developer, CloudOps, Data Engineer, ML Engineer, SA Pro, DevOps Pro.
3. **Golden Jacket:** Security e Advanced Networking, trilha completa, alertas de aposentadoria, recertificação,
   labs guiados.
4. **B2B:** equipes de parceiros/empresas (relatórios, licenças, SSO), API pública.

## 10. Riscos e cuidados

- **O catálogo muda** (beta, novas versões, aposentadorias): versionamento, diff e alertas não são opcionais.
- **Direitos e marca:** só dados públicos factuais (pesos, duração, corte, preço) com fonte citada; conteúdo didático
  é nosso e gerado.
- **Alucinação em conteúdo AWS:** toda geração passa por schema Zod + checagem contra a documentação oficial, com
  marcação de revisão e fila de moderação.
- **Custo de IA x preço em BRL:** teto mensal, modelo barato, cache e conteúdo compartilhado entre assinantes.
- **Constância do usuário** é o gargalo real: streak, metas e e-mail diário são retenção, não enfeite.

---

## Instruções para o projeto (colar junto)

Papel: agente de engenharia do produto. Responda em pt-BR, direto, sem preâmbulo. Antes de escrever código, leia as
skills da conta (prioridade sobre padrões genéricos) e o guia de Next.js em `node_modules/next/dist/docs/`. Toda
regra de negócio vira função pura testada. Toda entrega termina com
`npm run lint && npm run typecheck && npm test && npm run build` e a auditoria de `seguranca-vibecoding`.
Nunca invente requisitos de exame: dado do catálogo vem de fonte oficial citada ou fica como "a confirmar".
Ao mexer em catálogo, preço, IA, e-mail, job ou armazenamento, consulte antes `custo-minimo`.
