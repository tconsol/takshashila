import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_VERSION: z.string().default('v1'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 chars'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@takshashila.com'),

  GCP_PROJECT_ID: z.string().optional(),
  GCP_BUCKET_NAME: z.string().optional(),
  GCP_KEY_FILE: z.string().optional(),

  // ── Agora RTC ───────────────────────────────────────────────────────────────
  AGORA_APP_ID: z.string().min(1, 'AGORA_APP_ID is required'),
  AGORA_APP_CERTIFICATE: z.string().min(1, 'AGORA_APP_CERTIFICATE is required'),
  AGORA_TOKEN_EXPIRE_SECONDS: z.coerce.number().default(3600),

  // ── Agora Cloud Recording ───────────────────────────────────────────────────
  AGORA_CUSTOMER_ID: z.string().optional(),
  AGORA_CUSTOMER_SECRET: z.string().optional(),
  AGORA_RECORDING_ENABLED: z.coerce.boolean().default(false),
  GCS_ACCESS_KEY: z.string().optional(),
  GCS_SECRET_KEY: z.string().optional(),
  GCS_RECORDING_BUCKET: z.string().optional(),

  // ── Agora Whiteboard (Netless) ──────────────────────────────────────────────
  AGORA_WHITEBOARD_APP_ID: z.string().optional(),
  AGORA_WHITEBOARD_AK: z.string().optional(),
  AGORA_WHITEBOARD_SK: z.string().optional(),
  AGORA_WHITEBOARD_REGION: z.string().default('sg'),
  AGORA_WHITEBOARD_TOKEN_EXPIRY_HOURS: z.coerce.number().default(24),

  // ── Payments ────────────────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
