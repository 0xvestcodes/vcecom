import { z } from "zod";

/**
 * Environment variable validation schema
 * Validates all required and optional environment variables at startup
 * Fails fast if critical variables are missing or invalid
 */
const envSchema = z.object({
  // Core Application Configuration
  NODE_ENV: z
    .enum(["development", "production", "test", "staging"])
    .default("development"),
  PORT: z.string().regex(/^\d+$/).default("3001").transform(Number),

  // Database Configuration (Required)
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid PostgreSQL connection URL"),

  // Redis Configuration (Required)
  REDIS_URL: z.string().url("REDIS_URL must be a valid Redis connection URL"),

  // JWT Configuration (Required)
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long")
    .refine(
      (val) => val !== "change-me-in-production",
      "JWT_SECRET must not be the default value 'change-me-in-production'",
    ),
  JWT_EXPIRES_IN: z.string().default("1d"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters long")
    .optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  ADMIN_ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),

  // CORS Configuration
  BACKEND_URL: z.string().url().optional(),
  STOREFRONT_URL: z.string().url().optional(),
  ADMIN_URL: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // Storage Configuration
  STORAGE_PROVIDER: z.enum(["minio", "s3", "supabase"]).default("minio"),
  STORAGE_BUCKET: z.string().default("vcecom"),

  // MinIO Configuration (Required if STORAGE_PROVIDER is minio)
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_USE_SSL: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  MINIO_PUBLIC_URL: z.string().url().optional(),

  // AWS S3 Configuration (Required if STORAGE_PROVIDER is s3)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_S3_PUBLIC_URL: z.string().url().optional(),

  // Supabase Configuration (Required if STORAGE_PROVIDER is supabase)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_STORAGE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

  // Payment Gateway Configuration
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_TIMEOUT_MS: z
    .string()
    .regex(/^\d+$/)
    .default("10000")
    .transform(Number),

  // Shipping Configuration (Optional)
  SHIPROCKET_EMAIL: z.string().email().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  NIMBUS_POST_API_KEY: z.string().optional(),
  NIMBUS_POST_API_SECRET: z.string().optional(),

  // Logging Configuration
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  LOG_PRETTY: z
    .string()
    .default("false")
    .transform((val) => val === "true"),

  // OpenTelemetry Tracing Configuration
  OTEL_TRACE_ENABLED: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  OTEL_TRACE_SAMPLING: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .default("0.1")
    .transform(Number),
  OTEL_EXPORTER_ZIPKIN_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default("vcecom-backend"),

  // Rate Limiting Configuration
  ADMIN_LOGIN_RATE_LIMIT: z
    .string()
    .regex(/^\d+$/)
    .default("100")
    .transform(Number),
  ADMIN_LOGIN_RATE_WINDOW: z
    .string()
    .regex(/^\d+$/)
    .default("300")
    .transform(Number),

  // Deployment Configuration
  DEPLOYMENT_REGION: z.string().optional(),

  // Seller Configuration
  SELLER_STATE: z.string().default("Maharashtra"),
});

/**
 * Validated environment variables
 * This object contains all validated environment variables with proper types
 */
export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validate environment variables
 * Call this at application startup to ensure all required variables are set
 * @throws Error if validation fails
 */
export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse(process.env);
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((err) => {
        const path = err.path.join(".");
        return `${path}: ${err.message}`;
      });

      throw new Error(
        `Environment variable validation failed:\n${errorMessages.join("\n")}\n\nPlease check your .env file and ensure all required variables are set correctly.`,
      );
    }
    throw error;
  }
}

/**
 * Get validated environment variables
 * Returns the validated environment object, or throws if validation hasn't been called
 */
export function getEnv(): Env {
  if (!validatedEnv) {
    throw new Error(
      "Environment variables have not been validated. Call validateEnv() first.",
    );
  }
  return validatedEnv;
}

/**
 * Validate storage provider specific environment variables
 * Ensures required variables are set based on the selected storage provider
 */
export function validateStorageProviderEnv(env: Env): void {
  const provider = env.STORAGE_PROVIDER;

  switch (provider) {
    case "minio":
      if (!env.MINIO_ENDPOINT) {
        throw new Error(
          "MINIO_ENDPOINT is required when STORAGE_PROVIDER is 'minio'",
        );
      }
      if (!env.MINIO_ACCESS_KEY) {
        throw new Error(
          "MINIO_ACCESS_KEY is required when STORAGE_PROVIDER is 'minio'",
        );
      }
      if (!env.MINIO_SECRET_KEY) {
        throw new Error(
          "MINIO_SECRET_KEY is required when STORAGE_PROVIDER is 'minio'",
        );
      }
      break;

    case "s3":
      if (!env.AWS_ACCESS_KEY_ID) {
        throw new Error(
          "AWS_ACCESS_KEY_ID is required when STORAGE_PROVIDER is 's3'",
        );
      }
      if (!env.AWS_SECRET_ACCESS_KEY) {
        throw new Error(
          "AWS_SECRET_ACCESS_KEY is required when STORAGE_PROVIDER is 's3'",
        );
      }
      break;

    case "supabase":
      if (!env.SUPABASE_URL) {
        throw new Error(
          "SUPABASE_URL is required when STORAGE_PROVIDER is 'supabase'",
        );
      }
      if (!env.SUPABASE_STORAGE_KEY) {
        throw new Error(
          "SUPABASE_STORAGE_KEY is required when STORAGE_PROVIDER is 'supabase'",
        );
      }
      if (!env.SUPABASE_ANON_KEY) {
        throw new Error(
          "SUPABASE_ANON_KEY is required when STORAGE_PROVIDER is 'supabase'",
        );
      }
      break;
  }
}
