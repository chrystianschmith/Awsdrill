# 0006 · Markdown restrito próprio em vez de react-markdown + rehype-sanitize

- **Decisão (2026-10-24):** o texto gerado por IA é lido por `src/lib/ai/markdown.ts` (parágrafos, `###`, listas, **negrito** e `código`) e vira só nós de texto do React; diverge de `seguranca-vibecoding` §9, que pede `react-markdown` + `rehype-sanitize`.
- **Motivo:** sem HTML, links nem imagens não há o que sanitizar (o React escapa tudo); evita duas dependências novas (§13, `custo-minimo`: poucos pacotes) para um formato que o prompt já limita. Links vêm só das fontes, validadas como https de host oficial.
- **Limite mantido:** teste prova que `<script>`, `javascript:` e imagens ficam como texto literal; se um dia precisar de tabelas ou links no corpo, migrar para react-markdown + rehype-sanitize.
