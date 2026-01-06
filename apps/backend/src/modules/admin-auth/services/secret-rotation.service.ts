import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { and, desc, eq, gte, jwtSecrets } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import type { Database } from "../../../modules/database/db";
import { DB_TOKEN } from "../../database/database.module";

/**
 * Secret Rotation Service
 * Manages JWT secret rotation with database-backed versioning and grace period support
 */
@Injectable()
export class SecretRotationService implements OnModuleInit {
  private readonly rotationEnabled: boolean;
  private readonly rotationIntervalDays: number;
  private readonly gracePeriodDays: number;
  private readonly encryptionKey: Buffer;
  private readonly encryptionAlgorithm = "aes-256-gcm";

  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    // Check if rotation is enabled (env vars are always strings)
    const rotationEnabledEnv =
      process.env.JWT_SECRET_ROTATION_ENABLED === "true";
    this.rotationEnabled = rotationEnabledEnv;
    this.rotationIntervalDays = parseInt(
      process.env.JWT_SECRET_ROTATION_INTERVAL_DAYS || "30",
      10,
    );
    this.gracePeriodDays = parseInt(
      process.env.JWT_SECRET_GRACE_PERIOD_DAYS || "7",
      10,
    );

    // Derive encryption key from JWT_SECRET for encrypting secrets in DB
    // In production, use a dedicated encryption key from env
    const secretKey =
      process.env.JWT_SECRET_ENCRYPTION_KEY || process.env.JWT_SECRET || "";
    // Ensure key is exactly 32 bytes for AES-256
    const keyString = secretKey.padEnd(32, "0").slice(0, 32);
    this.encryptionKey = Buffer.from(keyString, "utf8");
  }

  async onModuleInit() {
    if (!this.rotationEnabled) {
      this.logger.info(
        createLogContext(this.contextService, "secretRotationInit"),
        "JWT secret rotation is disabled",
      );
      return;
    }

    // Initialize: ensure we have at least one secret version
    await this.ensureInitialSecret();
  }

  /**
   * Ensure initial secret exists (for first-time setup)
   */
  private async ensureInitialSecret(): Promise<void> {
    try {
      const activeSecrets = await this.db
        .select()
        .from(jwtSecrets)
        .where(eq(jwtSecrets.isActive, true))
        .limit(1);

      if (activeSecrets.length === 0) {
        // No active secret exists, create one from environment variable
        const envSecret = process.env.JWT_SECRET;
        if (!envSecret) {
          this.logger.warn(
            createLogContext(this.contextService, "ensureInitialSecret"),
            "No JWT_SECRET found in environment, secret rotation may not work",
          );
          return;
        }

        await this.createSecretVersion(envSecret, true);
        this.logger.info(
          createLogContext(this.contextService, "ensureInitialSecret"),
          "Initial JWT secret version created from environment",
        );
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "ensureInitialSecret", error),
        "Failed to ensure initial secret",
      );
    }
  }

  /**
   * Get current active secret for signing tokens
   */
  async getCurrentSecret(): Promise<string> {
    if (!this.rotationEnabled) {
      // Fallback to environment variable if rotation is disabled
      return process.env.JWT_SECRET || "";
    }

    try {
      const [activeSecret] = await this.db
        .select()
        .from(jwtSecrets)
        .where(eq(jwtSecrets.isActive, true))
        .orderBy(desc(jwtSecrets.createdAt))
        .limit(1);

      if (!activeSecret) {
        // Fallback to environment variable
        const envSecret = process.env.JWT_SECRET || "";
        this.logger.warn(
          createLogContext(this.contextService, "getCurrentSecret"),
          "No active secret found in database, using environment variable",
        );
        return envSecret;
      }

      return this.decryptSecret(activeSecret.secret);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getCurrentSecret", error),
        "Failed to get current secret, falling back to environment variable",
      );
      return process.env.JWT_SECRET || "";
    }
  }

  /**
   * Get all valid secrets for token validation (current + grace period)
   */
  async getValidSecrets(): Promise<string[]> {
    if (!this.rotationEnabled) {
      // Return environment secret only
      const envSecret = process.env.JWT_SECRET;
      return envSecret ? [envSecret] : [];
    }

    try {
      const now = new Date();
      const gracePeriodStart = new Date(now);
      gracePeriodStart.setDate(
        gracePeriodStart.getDate() - this.gracePeriodDays,
      );

      // Get active secrets and recently rotated secrets (within grace period)
      const validSecrets = await this.db
        .select()
        .from(jwtSecrets)
        .where(
          and(
            gte(jwtSecrets.createdAt, gracePeriodStart),
            // Include active secrets or secrets rotated within grace period
          ),
        )
        .orderBy(desc(jwtSecrets.createdAt));

      return validSecrets.map((secret) => this.decryptSecret(secret.secret));
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getValidSecrets", error),
        "Failed to get valid secrets, falling back to environment variable",
      );
      const envSecret = process.env.JWT_SECRET;
      return envSecret ? [envSecret] : [];
    }
  }

  /**
   * Create a new secret version
   */
  async createSecretVersion(
    secret: string,
    setAsActive: boolean = false,
  ): Promise<string> {
    const version = `v${Date.now()}`;
    const encryptedSecret = this.encryptSecret(secret);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.rotationIntervalDays);

    try {
      // If setting as active, deactivate all other secrets
      if (setAsActive) {
        await this.db
          .update(jwtSecrets)
          .set({ isActive: false, rotatedAt: new Date() })
          .where(eq(jwtSecrets.isActive, true));
      }

      await this.db.insert(jwtSecrets).values({
        secret: encryptedSecret,
        version,
        isActive: setAsActive,
        expiresAt,
      });

      this.logger.info(
        createLogContext(this.contextService, "createSecretVersion", {
          version,
          isActive: setAsActive,
        }),
        "New JWT secret version created",
      );

      return version;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "createSecretVersion", error),
        "Failed to create secret version",
      );
      throw error;
    }
  }

  /**
   * Rotate to a new secret
   */
  async rotateSecret(): Promise<string> {
    if (!this.rotationEnabled) {
      throw new Error("Secret rotation is disabled");
    }

    // Generate new secret
    const newSecret = randomBytes(32).toString("hex");

    // Create new version and set as active
    const version = await this.createSecretVersion(newSecret, true);

    this.logger.info(
      createLogContext(this.contextService, "rotateSecret", { version }),
      "JWT secret rotated successfully",
    );

    return version;
  }

  /**
   * Check if rotation is needed and perform it
   */
  async checkAndRotateIfNeeded(): Promise<boolean> {
    if (!this.rotationEnabled) {
      return false;
    }

    try {
      const [activeSecret] = await this.db
        .select()
        .from(jwtSecrets)
        .where(eq(jwtSecrets.isActive, true))
        .orderBy(desc(jwtSecrets.createdAt))
        .limit(1);

      if (!activeSecret) {
        // No active secret, create one
        await this.rotateSecret();
        return true;
      }

      // Check if secret is expiring soon (within grace period)
      const now = new Date();
      const rotationThreshold = new Date(activeSecret.expiresAt);
      rotationThreshold.setDate(
        rotationThreshold.getDate() - this.gracePeriodDays,
      );

      if (now >= rotationThreshold) {
        await this.rotateSecret();
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "checkAndRotateIfNeeded",
          error,
        ),
        "Failed to check and rotate secret",
      );
      return false;
    }
  }

  /**
   * Encrypt secret before storing in database
   */
  private encryptSecret(secret: string): string {
    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv(
        this.encryptionAlgorithm,
        this.encryptionKey,
        iv,
      );

      let encrypted = cipher.update(secret, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      // Return IV + authTag + encrypted data
      return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "encryptSecret", error),
        "Failed to encrypt secret",
      );
      throw error;
    }
  }

  /**
   * Decrypt secret from database
   */
  private decryptSecret(encrypted: string): string {
    try {
      const [ivHex, authTagHex, encryptedData] = encrypted.split(":");

      if (!ivHex || !authTagHex || !encryptedData) {
        throw new Error("Invalid encrypted secret format");
      }

      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");

      const decipher = createDecipheriv(
        this.encryptionAlgorithm,
        this.encryptionKey,
        iv,
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "decryptSecret", error),
        "Failed to decrypt secret",
      );
      throw error;
    }
  }
}
