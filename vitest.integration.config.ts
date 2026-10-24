import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Testes de integração com Postgres real (banco descartável).
 * Use TEST_DATABASE_URL; as migrations precisam estar aplicadas nele.
 */
const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/trilha_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/setup/sem-rede.ts"],
    include: ["tests/integration/**/*.test.ts"],
    env: { TZ: "UTC", DATABASE_URL: url },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
