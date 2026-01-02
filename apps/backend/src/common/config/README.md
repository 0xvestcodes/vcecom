# Configuration Module

A centralized, type-safe configuration module for the VCEcom backend application.

## Overview

The configuration module provides:
- **Type-safe** access to all environment variables
- **Validated** configuration at startup (fail-fast approach)
- **Organized** configuration groups (database, storage, payment, etc.)
- **Dependency injection** support via NestJS

## Architecture

```
config/
├── index.ts                 # Centralized exports
├── config.module.ts         # NestJS module definition
├── app.config.service.ts   # Main configuration service
├── config.types.ts         # TypeScript type definitions
├── config.loader.ts        # Configuration loader utility
├── env.validation.ts       # Zod schema validation
└── README.md               # This file
```

## Usage

### 1. Loading Configuration

Configuration is automatically loaded and validated in `main.ts` before NestJS bootstrap:

```typescript
import { ConfigLoader } from "./common/config/config.loader";

// In main.ts
ConfigLoader.load(); // Validates all environment variables
```

### 2. Using Configuration Service

Inject `AppConfigService` into your services:

```typescript
import { Injectable } from "@nestjs/common";
import { AppConfigService } from "./common/config/app.config.service";

@Injectable()
export class MyService {
  constructor(private readonly configService: AppConfigService) {}

  someMethod() {
    // Get specific configuration
    const dbUrl = this.configService.getDatabaseUrl();
    const razorpayConfig = this.configService.getRazorpayConfig();
    
    // Get complete configuration
    const config = this.configService.getConfig();
    
    // Check environment
    if (this.configService.isProductionEnvironment()) {
      // Production-specific logic
    }
  }
}
```

### 3. Configuration Groups

The service provides organized getters for different configuration groups:

#### Core Configuration
- `getNodeEnv()` - Node environment (development, production, test, staging)
- `getPort()` - Server port
- `getSellerState()` - Default seller state

#### Database & Redis
- `getDatabaseConfig()` - Database configuration
- `getRedisConfig()` - Redis configuration

#### Authentication
- `getJwtConfig()` - JWT configuration (secret, expiration, etc.)

#### CORS
- `getCorsConfig()` - CORS configuration (allowed origins, URLs)

#### Storage
- `getStorageProvider()` - Storage provider (minio, s3, supabase)
- `getMinioConfig()` - MinIO configuration
- `getAwsS3Config()` - AWS S3 configuration
- `getSupabaseConfig()` - Supabase configuration

#### Payment Gateway
- `getRazorpayConfig()` - Razorpay configuration (key ID, secret, timeout)

#### Shipping
- `getShiprocketConfig()` - Shiprocket configuration
- `getNimbusPostConfig()` - Nimbus Post configuration

#### Logging & Tracing
- `getLoggingConfig()` - Logging configuration (level, pretty print)
- `getTracingConfig()` - OpenTelemetry tracing configuration

#### Rate Limiting
- `getRateLimitConfig()` - Rate limiting configuration

#### Deployment
- `getDeploymentConfig()` - Deployment configuration (region, etc.)

### 4. Type Safety

All configuration is type-safe using TypeScript interfaces:

```typescript
import type { RazorpayConfig, AppConfig } from "./common/config";

const razorpayConfig: RazorpayConfig = configService.getRazorpayConfig();
const fullConfig: AppConfig = configService.getConfig();
```

## Environment Variables

Environment variables are validated using Zod schemas. See `env.validation.ts` for the complete schema.

### Required Variables

- `DATABASE_URL` - PostgreSQL connection URL
- `REDIS_URL` - Redis connection URL
- `JWT_SECRET` - JWT secret (minimum 32 characters)

### Optional Variables

Most other variables are optional with sensible defaults. See `.env.example` for complete documentation.

## Validation

Configuration validation happens at startup:

1. **Environment Variable Validation** - Validates all environment variables against Zod schema
2. **Storage Provider Validation** - Validates provider-specific variables based on `STORAGE_PROVIDER`
3. **Fail-Fast** - Application won't start if validation fails

## Error Handling

If validation fails, the application will:
1. Log detailed error messages
2. Exit with a non-zero code
3. Provide clear guidance on what needs to be fixed

Example error:
```
Environment variable validation failed:
DATABASE_URL: Required
JWT_SECRET: String must contain at least 32 character(s)

Please check your .env file and ensure all required variables are set correctly.
```

## Testing

For testing, you can reset the validation state:

```typescript
import { ConfigLoader } from "./common/config/config.loader";

beforeEach(() => {
  ConfigLoader.reset();
});
```

## Best Practices

1. **Always use AppConfigService** - Don't access `process.env` directly
2. **Use type-safe getters** - Use the provided getter methods instead of accessing `getEnv()`
3. **Group related configs** - Use configuration group getters (e.g., `getRazorpayConfig()`)
4. **Check environment** - Use `isProductionEnvironment()`, `isDevelopmentEnvironment()`, etc.
5. **Validate early** - Configuration is validated at startup, but ensure your tests also validate

## Examples

### Example 1: Database Connection

```typescript
@Injectable()
export class DatabaseService {
  constructor(private readonly config: AppConfigService) {}

  connect() {
    const dbConfig = this.config.getDatabaseConfig();
    // Use dbConfig.url for connection
  }
}
```

### Example 2: Payment Gateway

```typescript
@Injectable()
export class PaymentService {
  constructor(private readonly config: AppConfigService) {}

  initializeRazorpay() {
    const razorpayConfig = this.config.getRazorpayConfig();
    if (!razorpayConfig.keyId || !razorpayConfig.keySecret) {
      throw new Error("Razorpay not configured");
    }
    // Initialize Razorpay with config
  }
}
```

### Example 3: Environment-Specific Logic

```typescript
@Injectable()
export class EmailService {
  constructor(private readonly config: AppConfigService) {}

  sendEmail() {
    if (this.config.isDevelopmentEnvironment()) {
      // Use test email service
    } else {
      // Use production email service
    }
  }
}
```

## Migration Guide

If you're migrating from direct `process.env` access:

### Before
```typescript
const dbUrl = process.env.DATABASE_URL;
const port = parseInt(process.env.PORT || "3001", 10);
```

### After
```typescript
const dbUrl = this.configService.getDatabaseUrl();
const port = this.configService.getPort();
```

Benefits:
- Type safety
- Validated values
- Centralized configuration
- Better testability
