# 0002 · `pipeline-editais` adaptada a exam guides

- **Decisão:** reaproveitar o desenho da skill (descoberta, coleta, deduplicação por hash, versionamento com diff, publicação por confiança, moderação) para os exam guides oficiais.
- **Diferenças:** fonte é HTML/PDF oficial do exame, sem OCR; execução mensal no GitHub Actions, não diária; dado sem fonte citada fica `A_CONFIRMAR`.
- **Mantido:** allowlist e proteção de SSRF (`seguranca-vibecoding` §11), Zod na extração, IA mockada nos testes.
