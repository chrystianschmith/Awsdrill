# 0009 — Ponytail como modo dos agentes de código

Data: 2026-10-30. Status: aceito.

## Contexto
O Chrytian pediu para usar o [Ponytail](https://github.com/DietrichGebert/ponytail) (MIT) neste projeto. Não é
biblioteca do app: é um plugin para agentes de código (Claude Code, OpenCode e outros) que força a menor mudança
completa (YAGNI, reaproveitar o que já existe, sem dependência nova para poucas linhas, teste em lógica não trivial).

## Decisão
- Claude Code: `.claude/settings.json` registra o marketplace do Ponytail fixado na tag `v5.3.3` e habilita
  `ponytail@ponytail`. Quem abrir o repo recebe o plugin (o Claude Code pede confirmação para confiar no marketplace).
- OpenCode (Mac): instalar com `opencode plugin add @dietrichgebert/ponytail`. Não vai `opencode.json` no repo porque a
  chave muda entre OpenCode 1 (`plugin`) e 2 (`plugins`).
- Nada do Ponytail entra no bundle do app nem no `package.json`.

## Precedência
As skills da conta, o `CLAUDE.md` e os comandos de pronto continuam valendo acima do Ponytail. Em especial: "menos
código" nunca corta Zod nas entradas, revalidação de sessão, `ActionResult`, testes exigidos por `qualidade-entrega` nem
a auditoria `seguranca-vibecoding`.

## Consequências
- Atualizar o Ponytail é trocar o `ref` em `.claude/settings.json` depois de ler o diff da nova tag (código de hooks
  roda na máquina de quem usa).
- O "band" do plugin grava métricas locais em `~/.config/ponytail/band/`; o webhook vem desligado e deve ficar assim.
