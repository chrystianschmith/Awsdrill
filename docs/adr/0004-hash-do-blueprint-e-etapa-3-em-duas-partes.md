# 0004 · Hash do blueprint normalizado e etapa 3 em duas partes

- **Hash:** `sourceHash` é o SHA-256 do blueprint normalizado (códigos, nomes oficiais em inglês e pesos), não do HTML bruto. Mudança de layout da página não cria revisão; mudança de peso ou de task statement cria. A tradução (`namePt`) fica fora do hash.
- **Etapa 3a:** modelos, seed com fonte citada (lido em 2026-10-22), regras puras e páginas `/certificacoes`. **Etapa 3b:** pipeline mensal no GitHub Actions usando o mesmo `aplicarExame`.
- **Por quê:** o seed já entrega valor (site e base das etapas 4–5) sem esperar a coleta automática; a pipeline reaproveita a mesma escrita idempotente.
