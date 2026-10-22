import type { NextConfig } from "next";

// Cache Components fica desligado: quase todas as telas dependem da sessão do
// usuário e o modelo de renderização dinâmica clássico é mais simples de manter.
// Headers de segurança (CSP com nonce) são definidos em src/proxy.ts.
const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
