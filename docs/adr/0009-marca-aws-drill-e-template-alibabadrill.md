# 0009 · Marca AWS Drill e template visual do alibabadrill

- **Decisão (2026-10-30, Chrytian):** o produto passa a se chamar **AWS Drill**, com amarelo e preto, e segue o
  template do `chrystianschmith/alibabadrill`: barra superior de largura total (preta aqui), barra lateral fixa no
  desktop (≥1024px) com faixa de destaque à esquerda, abas horizontais roláveis no mobile e no tablet, Bricolage
  Grotesque em títulos, marca e números grandes, IBM Plex Sans no corpo, IBM Plex Mono em timer e letras das
  alternativas, escala de 17px no mobile e 18px a partir do laptop, cartões com raio de 12px.
- **Conflitos com as regras anteriores, seguidos por escolha do dono do produto:**
  - `docs/goal-contexto-aws.md` dizia que "AWS" não entra em nome, domínio nem logo. **Risco:** "AWS" é marca
    registrada da Amazon; usar no nome pode levar a pedido de remoção, troca forçada de nome/domínio ou recusa em
    lojas e meios de pagamento. Mitigação: aviso de não afiliação no rodapé, nenhuma alegação de parceria ou
    oficialidade (teste em `tests/unit/brand.test.ts`), logo sem elementos da identidade da Amazon.
  - `design-system-estudos` pede primária sóbria, raio máximo `rounded-lg` (8px) e barra inferior no mobile. O
    template usa amarelo, raio de 12px e abas no topo; seguimos o template.
- **Contraste:** amarelo só como fundo com texto preto (botão, avatar, logo). Texto, borda de seleção e barras de
  progresso usam `--primary-strong`: dourado escuro no tema claro (AA sobre branco) e o próprio amarelo no escuro. A
  barra superior usa a classe `dark` para que os tokens dentro dela resolvam para a versão escura nos dois temas.
- **Fontes:** arquivos `.woff2` locais em `src/app/fonts` (OFL), sem chamada ao Google Fonts, para manter a CSP.
