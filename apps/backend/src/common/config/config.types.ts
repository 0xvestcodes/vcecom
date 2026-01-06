import type { Env } from "./env.validation";

/**
 * Configuration type definitions
 * Provides type-safe interfaces for all configuration groups
 */

export interface DatabaseConfig {
  url: string;
}

export interface RedisConfig {
  url: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshSecret: string | undefined;
  refreshExpiresIn: string;
  adminExpiresIn: string;
}

export interface CorsConfig {
  backendUrl: string | undefined;
  storefrontUrl: string | undefined;
  adminUrl: string | undefined;
  allowedOrigins: string | undefined;
}

export interface StorageConfig {
  provider: Env["STORAGE_PROVIDER"];
  bucket: string;
}

export interface MinioConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  useSSL: boolean;
  bucket: string;
  publicUrl: string;
}

export interface AwsS3Config {
  accessKeyId: string | undefined;
  secretAccessKey: string | undefined;
  region: string;
  bucket: string;
  publicUrl: string | undefined;
}

export interface SupabaseConfig {
  url: string | undefined;
  storageKey: string | undefined;
  anonKey: string | undefined;
  bucket: string;
}

export interface RazorpayConfig {
  keyId: string | undefined;
  keySecret: string | undefined;
  webhookSecret: string | undefined;
  timeout: number;
}

export interface CashfreeConfig {
  appId: string | undefined;
  secretKey: string | undefined;
  webhookSecret: string | undefined;
  environment: "sandbox" | "production";
  timeout: number;
}

export interface PayUConfig {
  merchantKey: string | undefined;
  merchantSalt: string | undefined;
  webhookSecret: string | undefined;
  environment: "sandbox" | "production";
  timeout: number;
}

export interface ShiprocketConfig {
  email: string | undefined;
  password: string | undefined;
}

export interface NimbusPostConfig {
  apiKey: string | undefined;
  apiSecret: string | undefined;
}

export interface LoggingConfig {
  level: Env["LOG_LEVEL"];
  pretty: boolean;
}

export interface TracingConfig {
  enabled: boolean;
  sampling: number;
  otlpEndpoint: string | undefined;
  serviceName: string;
}

export interface RateLimitConfig {
  adminLoginLimit: number;
  adminLoginWindow: number;
}

export interface DeploymentConfig {
  region: string | undefined;
}

export interface SearchConfig {
  provider: Env["SEARCH_PROVIDER"];
  indexingEnabled: boolean;
  batchSize: number;
  reindexRateLimit: number;
}

export interface MeilisearchConfig {
  host: string | undefined;
  apiKey: string | undefined;
}

export interface ElasticsearchConfig {
  host: string | undefined;
  apiKey: string | undefined;
  username: string | undefined;
  password: string | undefined;
}

export interface OpenSearchConfig {
  host: string | undefined;
  apiKey: string | undefined;
  username: string | undefined;
  password: string | undefined;
}

export interface AppConfig {
  nodeEnv: Env["NODE_ENV"];
  port: number;
  sellerState: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  cors: CorsConfig;
  storage: StorageConfig;
  minio: MinioConfig;
  awsS3: AwsS3Config;
  supabase: SupabaseConfig;
  razorpay: RazorpayConfig;
  cashfree: CashfreeConfig;
  payu: PayUConfig;
  shiprocket: ShiprocketConfig;
  nimbusPost: NimbusPostConfig;
  logging: LoggingConfig;
  tracing: TracingConfig;
  rateLimit: RateLimitConfig;
  deployment: DeploymentConfig;
  search: SearchConfig;
  meilisearch: MeilisearchConfig;
  elasticsearch: ElasticsearchConfig;
  opensearch: OpenSearchConfig;
}
