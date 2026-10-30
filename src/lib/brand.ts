/**
 * Marca do produto (ADR 0010). O nome tem "AWS" por decisão do dono do produto; o risco de marca está registrado
 * no ADR. Nenhuma afiliação é alegada (teste em tests/unit/brand.test.ts).
 */
export const BRAND = {
  name: "AWS Drill",
  /** Partes do nome no logo: a segunda vai em amarelo. */
  partes: ["AWS", "Drill"],
  tagline: "Preparação para certificações de nuvem, com plano, simulados e prontidão medida.",
  supportEmail: "contato@example.com",
} as const;
