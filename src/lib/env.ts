import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(16).optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MENSAL: z.string().optional(),
  STRIPE_PRICE_ANUAL: z.string().optional(),
  STRIPE_PRICE_ANUAL_PIX: z.string().optional(),
  STRIPE_TRIAL_DAYS: z.coerce.number().int().min(0).max(30).default(7),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Trilha <nao-responda@example.com>"),

  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["gemini", "anthropic"]).optional(),
  AI_MODEL_DEFAULT: z.string().optional(),
  AI_MODEL_FALLBACK: z.string().optional(),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().min(0).default(20),
  ADMIN_ALERT_EMAIL: z.email().optional(),

  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Variáveis de ambiente validadas na primeira leitura (não no build). */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const campos = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Variáveis de ambiente inválidas: ${campos}`);
    }
    cached = parsed.data;
  }
  return cached;
}
