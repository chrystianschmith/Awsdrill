/**
 * Seed idempotente. Na etapa 1 não há dados: o catálogo (exames, domínios e pesos com fonte oficial) entra na etapa 3.
 * Uso: npm run db:seed
 */
async function main() {
  console.info("seed: nada a semear nesta etapa");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
