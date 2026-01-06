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
  // Note: Connection is non-blocking, so stub URLs are fine for doc generation
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

  // JWT Secret Rotation Configuration
  JWT_SECRET_ROTATION_ENABLED: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  JWT_SECRET_ROTATION_INTERVAL_DAYS: z
    .string()
    .regex(/^\d+$/)
    .default("30")
    .transform(Number),
  JWT_SECRET_GRACE_PERIOD_DAYS: z
    .string()
    .regex(/^\d+$/)
    .default("7")
    .transform(Number),
  JWT_SECRET_ENCRYPTION_KEY: z.string().optional(),

  // Security Risk Alerts Configuration
  RISK_ALERT_THRESHOLD_WARNING: z
    .string()
    .regex(/^\d+$/)
    .default("50")
    .transform(Number),
  RISK_ALERT_THRESHOLD_CRITICAL: z
    .string()
    .regex(/^\d+$/)
    .default("75")
    .transform(Number),

  // IP Heuristics Configuration
  IP_HEURISTICS_ENABLED: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  IP_REPUTATION_CACHE_TTL_HOURS: z
    .string()
    .regex(/^\d+$/)
    .default("24")
    .transform(Number),

  // CORS Configuration
  BACKEND_URL: z.string().url().optional(),
  STOREFRONT_URL: z.string().url().optional(),
  ADMIN_URL: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // Storage Configuration
  STORAGE_PROVIDER: z.enum(["minio", "s3", "supabase"]).default("minio"),
  STORAGE_BUCKET: z.string().default("vcecom"),
  STORAGE_PRODUCT_MEDIA_BUCKET: z.string().optional(),
  STORAGE_UPLOADS_BUCKET: z.string().optional(),
  STORAGE_INTERNAL_BUCKET: z.string().optional(),
  CDN_URL: z.string().url().optional(),
  MEDIA_CACHE_MAX_AGE: z
    .string()
    .regex(/^\d+$/)
    .default("31536000")
    .transform(Number),

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

  // Cashfree Configuration
  CASHFREE_APP_ID: z.string().optional(),
  CASHFREE_SECRET_KEY: z.string().optional(),
  CASHFREE_WEBHOOK_SECRET: z.string().optional(),
  CASHFREE_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  CASHFREE_TIMEOUT_MS: z
    .string()
    .regex(/^\d+$/)
    .default("10000")
    .transform(Number),

  // PayU Configuration
  PAYU_MERCHANT_KEY: z.string().optional(),
  PAYU_MERCHANT_SALT: z.string().optional(),
  PAYU_WEBHOOK_SECRET: z.string().optional(),
  PAYU_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  PAYU_TIMEOUT_MS: z.string().regex(/^\d+$/).default("10000").transform(Number),

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
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().url().optional(),
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

  // Security Configuration
  ADMIN_SESSION_SIGNING_ENABLED: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  SECURITY_ALERT_RISK_THRESHOLD: z
    .string()
    .regex(/^\d+$/)
    .default("70")
    .transform(Number),
  SECURITY_ALERT_LOGIN_ANOMALY_THRESHOLD: z
    .string()
    .regex(/^\d+$/)
    .default("60")
    .transform(Number),
  SECURITY_ALERT_BLOCK_THRESHOLD: z
    .string()
    .regex(/^\d+$/)
    .default("80")
    .transform(Number),
  IP_REPUTATION_ENABLED: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  IP_REPUTATION_BLOCK_THRESHOLD: z
    .string()
    .regex(/^\d+$/)
    .default("70")
    .transform(Number),
  HSTS_MAX_AGE: z.string().regex(/^\d+$/).default("31536000").transform(Number),
  HSTS_INCLUDE_SUBDOMAINS: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  HSTS_PRELOAD: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  CSP_ENABLED: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  EXPECT_CT_ENABLED: z
    .string()
    .default("false")
    .transform((val) => val === "true"),

  // Seller Configuration
  SELLER_STATE: z.string().default("Maharashtra"),

  // Search Configuration
  SEARCH_PROVIDER: z
    .enum(["meilisearch", "elasticsearch", "opensearch"])
    .default("meilisearch"),
  SEARCH_INDEXING_ENABLED: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  SEARCH_BATCH_SIZE: z.string().regex(/^\d+$/).default("100").transform(Number),
  SEARCH_REINDEX_RATE_LIMIT: z
    .string()
    .regex(/^\d+$/)
    .default("1000")
    .transform(Number),

  // Health Check Configuration
  HEALTH_CHECK_BASE_URLS: z.string().optional(),
  HEALTH_CHECK_ENDPOINT: z.string().default("/_health"),
  HEALTH_CHECK_TIMEOUT_MS: z
    .string()
    .regex(/^\d+$/)
    .default("5000")
    .transform(Number),

  // Meilisearch Configuration
  MEILISEARCH_HOST: z.string().url().optional(),
  MEILISEARCH_API_KEY: z.string().optional(),

  // Elasticsearch Configuration
  ELASTICSEARCH_HOST: z.string().url().optional(),
  ELASTICSEARCH_API_KEY: z.string().optional(),
  ELASTICSEARCH_USERNAME: z.string().optional(),
  ELASTICSEARCH_PASSWORD: z.string().optional(),

  // OpenSearch Configuration
  OPENSEARCH_HOST: z.string().url().optional(),
  OPENSEARCH_API_KEY: z.string().optional(),
  OPENSEARCH_USERNAME: z.string().optional(),
  OPENSEARCH_PASSWORD: z.string().optional(),

  // Queue Configuration (Optional)
  QUEUE_DEFAULT_RETRY_ATTEMPTS: z
    .string()
    .regex(/^\d+$/)
    .default("3")
    .transform(Number),
  QUEUE_DEFAULT_BACKOFF_DELAY: z
    .string()
    .regex(/^\d+$/)
    .default("1000")
    .transform(Number),
  QUEUE_CONCURRENCY: z.string().regex(/^\d+$/).default("5").transform(Number),
  QUEUE_REMOVE_ON_COMPLETE: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  QUEUE_REMOVE_ON_FAIL: z
    .string()
    .default("false")
    .transform((val) => val === "true"),

  // Email Configuration
  EMAIL_ENABLED: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().regex(/^\d+$/).default("587").transform(Number),
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // SMS Configuration
  SMS_ENABLED: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  SMS_PROVIDER: z.enum(["twilio", "aws-sns", "mock"]).default("mock"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  AWS_SNS_REGION: z.string().default("us-east-1"),
  AWS_SNS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SNS_SECRET_ACCESS_KEY: z.string().optional(),
  SMS_FROM_NUMBER: z.string().optional(),

  // Abandoned Cart Configuration
  ABANDONED_CART_DETECTION_HOURS: z
    .string()
    .regex(/^\d+$/)
    .default("1")
    .transform(Number),
  ABANDONED_CART_MIN_VALUE: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .default("0")
    .transform(Number),
  RECOVERY_EMAIL_DELAY_HOURS: z
    .string()
    .regex(/^\d+$/)
    .default("1")
    .transform(Number),
  RECOVERY_SMS_DELAY_HOURS: z
    .string()
    .regex(/^\d+$/)
    .default("2")
    .transform(Number),
  MAX_RECOVERY_ATTEMPTS: z
    .string()
    .regex(/^\d+$/)
    .default("3")
    .transform(Number),
  RECOVERY_DISCOUNT_PERCENTAGE: z
    .string()
    .regex(/^\d+$/)
    .default("10")
    .transform(Number),
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
