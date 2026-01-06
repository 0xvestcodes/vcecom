import "dotenv/config";
import { Injectable, OnModuleInit } from "@nestjs/common";
import type { AppConfig, DatabaseConfig, RedisConfig } from "./config.types";
import { type Env, getEnv } from "./env.validation";

/**
 * Application configuration service
 * Centralizes access to environment variables and configuration values
 * This ensures configurable data is at high levels and follows dependency injection principles
 * Uses validated environment variables for type safety
 */
@Injectable()
export class AppConfigService implements OnModuleInit {
  private env: Env;

  constructor() {
    // Initialize env immediately in constructor to ensure it's available
    // This is safe because validateEnv() should be called in main.ts before NestJS bootstrap
    try {
      this.env = getEnv();
    } catch (_error) {
      // Fallback to process.env if validation hasn't been called yet
      // This can happen during module initialization
      console.warn(
        "Config service: Using unvalidated environment variables. Ensure validateEnv() is called in main.ts",
      );
      // Use process.env as fallback (not type-safe but allows app to start)
      this.env = process.env as unknown as Env;
    }
  }

  onModuleInit() {
    // Re-validate on module init to ensure we have the latest validated env
    // This ensures that if validation happens after constructor, we update
    try {
      this.env = getEnv();
    } catch (_error) {
      // If validation still fails, keep using the fallback from constructor
      console.warn(
        "Config service: Still using unvalidated environment variables after module init",
      );
    }
  }

  /**
   * Ensure env is initialized
   */
  private ensureEnvInitialized(): void {
    if (!this.env) {
      // Fallback initialization if somehow env wasn't set
      try {
        this.env = getEnv();
      } catch {
        this.env = process.env as unknown as Env;
      }
    }
  }

  /**
   * Get validated environment variables
   * @returns Validated environment object
   */
  getEnv(): Env {
    this.ensureEnvInitialized();
    return this.env;
  }

  /**
   * Get complete application configuration
   * Returns all configuration in a structured format
   */
  getConfig(): AppConfig {
    return {
      nodeEnv: this.getNodeEnv(),
      port: this.getPort(),
      sellerState: this.getSellerState(),
      database: this.getDatabaseConfig(),
      redis: this.getRedisConfig(),
      jwt: this.getJwtConfig(),
      cors: this.getCorsConfig(),
      storage: {
        provider: this.getStorageProvider(),
        bucket: this.getStorageBucket(),
      },
      minio: this.getMinioConfig(),
      awsS3: this.getAwsS3Config(),
      supabase: this.getSupabaseConfig(),
      razorpay: this.getRazorpayConfig(),
      cashfree: this.getCashfreeConfig(),
      payu: this.getPayUConfig(),
      shiprocket: this.getShiprocketConfig(),
      nimbusPost: this.getNimbusPostConfig(),
      logging: this.getLoggingConfig(),
      tracing: this.getTracingConfig(),
      rateLimit: this.getRateLimitConfig(),
      deployment: this.getDeploymentConfig(),
      search: this.getSearchConfig(),
      meilisearch: this.getMeilisearchConfig(),
      elasticsearch: this.getElasticsearchConfig(),
      opensearch: this.getOpenSearchConfig(),
    };
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(): DatabaseConfig {
    return {
      url: this.getDatabaseUrl(),
    };
  }

  /**
   * Get Redis configuration
   */
  getRedisConfig(): RedisConfig {
    return {
      url: this.getRedisUrl(),
    };
  }

  /**
   * Get node environment
   */
  getNodeEnv(): Env["NODE_ENV"] {
    this.ensureEnvInitialized();
    return this.env.NODE_ENV;
  }

  /**
   * Get server port
   */
  getPort(): number {
    this.ensureEnvInitialized();
    return this.env.PORT;
  }

  /**
   * Get database URL
   */
  getDatabaseUrl(): string {
    this.ensureEnvInitialized();
    return this.env.DATABASE_URL;
  }

  /**
   * Get Redis URL
   */
  getRedisUrl(): string {
    this.ensureEnvInitialized();
    return this.env.REDIS_URL;
  }

  /**
   * Get seller state (defaults to Maharashtra)
   */
  getSellerState(): string {
    this.ensureEnvInitialized();
    return this.env.SELLER_STATE;
  }

  /**
   * Get storage provider type
   */
  getStorageProvider(): Env["STORAGE_PROVIDER"] {
    this.ensureEnvInitialized();
    return this.env.STORAGE_PROVIDER;
  }

  /**
   * Get storage bucket name
   */
  getStorageBucket(): string {
    this.ensureEnvInitialized();
    return this.env.STORAGE_BUCKET;
  }

  /**
   * Get bucket name for a specific bucket type
   * Falls back to default STORAGE_BUCKET if not configured
   */
  getBucketForType(
    bucketType: "product-media" | "uploads" | "internal",
  ): string {
    this.ensureEnvInitialized();
    switch (bucketType) {
      case "product-media":
        return this.env.STORAGE_PRODUCT_MEDIA_BUCKET || this.env.STORAGE_BUCKET;
      case "uploads":
        return this.env.STORAGE_UPLOADS_BUCKET || this.env.STORAGE_BUCKET;
      case "internal":
        return this.env.STORAGE_INTERNAL_BUCKET || this.env.STORAGE_BUCKET;
      default:
        return this.env.STORAGE_BUCKET;
    }
  }

  /**
   * Get CDN URL if configured
   */
  getCdnUrl(): string | undefined {
    this.ensureEnvInitialized();
    return this.env.CDN_URL;
  }

  /**
   * Get media cache max age in seconds
   */
  getMediaCacheMaxAge(): number {
    this.ensureEnvInitialized();
    return this.env.MEDIA_CACHE_MAX_AGE;
  }

  /**
   * Get AWS S3 configuration
   */
  getAwsS3Config(): {
    accessKeyId: string | undefined;
    secretAccessKey: string | undefined;
    region: string;
    bucket: string;
    publicUrl: string | undefined;
  } {
    this.ensureEnvInitialized();
    return {
      accessKeyId: this.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: this.env.AWS_SECRET_ACCESS_KEY,
      region: this.env.AWS_REGION,
      bucket: this.getStorageBucket(),
      publicUrl: this.env.AWS_S3_PUBLIC_URL,
    };
  }

  /**
   * Get Supabase configuration
   */
  getSupabaseConfig(): {
    url: string | undefined;
    storageKey: string | undefined;
    anonKey: string | undefined;
    bucket: string;
  } {
    this.ensureEnvInitialized();
    return {
      url: this.env.SUPABASE_URL,
      storageKey: this.env.SUPABASE_STORAGE_KEY,
      anonKey: this.env.SUPABASE_ANON_KEY,
      bucket: this.getStorageBucket(),
    };
  }

  /**
   * Get MinIO configuration
   */
  getMinioConfig(): {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    useSSL: boolean;
    bucket: string;
    publicUrl: string;
  } {
    this.ensureEnvInitialized();
    const endpoint = this.env.MINIO_ENDPOINT || "localhost:9000";
    return {
      endpoint,
      accessKey: this.env.MINIO_ACCESS_KEY || "minioadmin",
      secretKey: this.env.MINIO_SECRET_KEY || "minioadmin",
      useSSL: this.env.MINIO_USE_SSL,
      bucket: this.getStorageBucket(),
      publicUrl:
        this.env.MINIO_PUBLIC_URL ||
        `http://${endpoint}/${this.getStorageBucket()}`,
    };
  }

  /**
   * Get Shiprocket configuration
   */
  getShiprocketConfig(): {
    email: string | undefined;
    password: string | undefined;
  } {
    return {
      email: this.env.SHIPROCKET_EMAIL,
      password: this.env.SHIPROCKET_PASSWORD,
    };
  }

  /**
   * Get Nimbus Post configuration
   */
  getNimbusPostConfig(): {
    apiKey: string | undefined;
    apiSecret: string | undefined;
  } {
    return {
      apiKey: this.env.NIMBUS_POST_API_KEY,
      apiSecret: this.env.NIMBUS_POST_API_SECRET,
    };
  }

  /**
   * Get Razorpay configuration
   */
  getRazorpayConfig(): {
    keyId: string | undefined;
    keySecret: string | undefined;
    webhookSecret: string | undefined;
    timeout: number;
  } {
    return {
      keyId: this.env.RAZORPAY_KEY_ID,
      keySecret: this.env.RAZORPAY_KEY_SECRET,
      webhookSecret: this.env.RAZORPAY_WEBHOOK_SECRET,
      timeout: this.env.RAZORPAY_TIMEOUT_MS,
    };
  }

  /**
   * Get Cashfree configuration
   */
  getCashfreeConfig(): {
    appId: string | undefined;
    secretKey: string | undefined;
    webhookSecret: string | undefined;
    environment: "sandbox" | "production";
    timeout: number;
  } {
    return {
      appId: this.env.CASHFREE_APP_ID,
      secretKey: this.env.CASHFREE_SECRET_KEY,
      webhookSecret: this.env.CASHFREE_WEBHOOK_SECRET,
      environment: this.env.CASHFREE_ENVIRONMENT,
      timeout: this.env.CASHFREE_TIMEOUT_MS,
    };
  }

  /**
   * Get PayU configuration
   */
  getPayUConfig(): {
    merchantKey: string | undefined;
    merchantSalt: string | undefined;
    webhookSecret: string | undefined;
    environment: "sandbox" | "production";
    timeout: number;
  } {
    return {
      merchantKey: this.env.PAYU_MERCHANT_KEY,
      merchantSalt: this.env.PAYU_MERCHANT_SALT,
      webhookSecret: this.env.PAYU_WEBHOOK_SECRET,
      environment: this.env.PAYU_ENVIRONMENT,
      timeout: this.env.PAYU_TIMEOUT_MS,
    };
  }

  /**
   * Get JWT configuration
   */
  getJwtConfig(): {
    secret: string;
    expiresIn: string;
    refreshSecret: string | undefined;
    refreshExpiresIn: string;
    adminExpiresIn: string;
  } {
    return {
      secret: this.env.JWT_SECRET,
      expiresIn: this.env.JWT_EXPIRES_IN,
      refreshSecret: this.env.JWT_REFRESH_SECRET,
      refreshExpiresIn: this.env.JWT_REFRESH_EXPIRES_IN,
      adminExpiresIn: this.env.ADMIN_ACCESS_TOKEN_EXPIRES_IN,
    };
  }

  /**
   * Get CORS configuration
   */
  getCorsConfig(): {
    backendUrl: string | undefined;
    storefrontUrl: string | undefined;
    adminUrl: string | undefined;
    allowedOrigins: string | undefined;
  } {
    return {
      backendUrl: this.env.BACKEND_URL,
      storefrontUrl: this.env.STOREFRONT_URL,
      adminUrl: this.env.ADMIN_URL,
      allowedOrigins: this.env.ALLOWED_ORIGINS,
    };
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig(): {
    level: Env["LOG_LEVEL"];
    pretty: boolean;
  } {
    return {
      level: this.env.LOG_LEVEL,
      pretty: this.env.LOG_PRETTY,
    };
  }

  /**
   * Get OpenTelemetry tracing configuration
   */
  getTracingConfig(): {
    enabled: boolean;
    sampling: number;
    otlpEndpoint: string | undefined;
    serviceName: string;
  } {
    return {
      enabled: this.env.OTEL_TRACE_ENABLED,
      sampling: this.env.OTEL_TRACE_SAMPLING,
      otlpEndpoint:
        this.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
        this.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      serviceName: this.env.OTEL_SERVICE_NAME,
    };
  }

  /**
   * Get rate limiting configuration
   */
  getRateLimitConfig(): {
    adminLoginLimit: number;
    adminLoginWindow: number;
  } {
    return {
      adminLoginLimit: this.env.ADMIN_LOGIN_RATE_LIMIT,
      adminLoginWindow: this.env.ADMIN_LOGIN_RATE_WINDOW,
    };
  }

  /**
   * Get deployment configuration
   */
  getDeploymentConfig(): {
    region: string | undefined;
  } {
    this.ensureEnvInitialized();
    return {
      region: this.env.DEPLOYMENT_REGION,
    };
  }

  /**
   * Check if running in test environment
   */
  isTestEnvironment(): boolean {
    this.ensureEnvInitialized();
    return this.env.NODE_ENV === "test";
  }

  /**
   * Check if running in development environment
   */
  isDevelopmentEnvironment(): boolean {
    this.ensureEnvInitialized();
    return this.env.NODE_ENV === "development";
  }

  /**
   * Check if running in production environment
   */
  isProductionEnvironment(): boolean {
    this.ensureEnvInitialized();
    return this.env.NODE_ENV === "production";
  }

  /**
   * Get search configuration
   */
  getSearchConfig(): {
    provider: Env["SEARCH_PROVIDER"];
    indexingEnabled: boolean;
    batchSize: number;
    reindexRateLimit: number;
  } {
    this.ensureEnvInitialized();
    return {
      provider: this.env.SEARCH_PROVIDER,
      indexingEnabled: this.env.SEARCH_INDEXING_ENABLED,
      batchSize: this.env.SEARCH_BATCH_SIZE,
      reindexRateLimit: this.env.SEARCH_REINDEX_RATE_LIMIT,
    };
  }

  /**
   * Get Meilisearch configuration
   */
  getMeilisearchConfig(): {
    host: string | undefined;
    apiKey: string | undefined;
  } {
    this.ensureEnvInitialized();
    return {
      host: this.env.MEILISEARCH_HOST,
      apiKey: this.env.MEILISEARCH_API_KEY,
    };
  }

  /**
   * Get Elasticsearch configuration
   */
  getElasticsearchConfig(): {
    host: string | undefined;
    apiKey: string | undefined;
    username: string | undefined;
    password: string | undefined;
  } {
    this.ensureEnvInitialized();
    return {
      host: this.env.ELASTICSEARCH_HOST,
      apiKey: this.env.ELASTICSEARCH_API_KEY,
      username: this.env.ELASTICSEARCH_USERNAME,
      password: this.env.ELASTICSEARCH_PASSWORD,
    };
  }

  /**
   * Get OpenSearch configuration
   */
  getOpenSearchConfig(): {
    host: string | undefined;
    apiKey: string | undefined;
    username: string | undefined;
    password: string | undefined;
  } {
    this.ensureEnvInitialized();
    return {
      host: this.env.OPENSEARCH_HOST,
      apiKey: this.env.OPENSEARCH_API_KEY,
      username: this.env.OPENSEARCH_USERNAME,
      password: this.env.OPENSEARCH_PASSWORD,
    };
  }
}
