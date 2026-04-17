import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),

  INTERNAL_WEBHOOK_SECRET: z.string().min(32, {
    message: "INTERNAL_WEBHOOK_SECRET must be ≥32 chars (openssl rand -hex 32).",
  }),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),

  VAPI_API_KEY: z.string().min(1),
  VAPI_WEBHOOK_SECRET: z.string().min(1),
  VAPI_PHONE_NUMBER_ID: z.string().min(1),

  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  SHOPIFY_WEBHOOK_SECRET: z.string().optional(),
  WOOCOMMERCE_WEBHOOK_SECRET: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    const message = `Invalid environment configuration:\n${issues}`;

    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    console.warn(`[env] ${message}`);
  }

  cached = (parsed.success ? parsed.data : (process.env as unknown as Env)) as Env;
  return cached;
}

export const env = getEnv();
