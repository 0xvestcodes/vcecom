import * as crypto from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { apiKeys, users } from "@vcecom/db";
import * as bcrypt from "bcrypt";
import { and, eq } from "drizzle-orm";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";

export interface CreateApiKeyDto {
  name: string;
  type: "read" | "write" | "admin";
  expiresAt?: Date;
  scopes?: string[];
  rateLimit?: {
    requests: number;
    window: number; // in seconds
  };
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  type: string;
  status: string;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  // Only returned on creation
  apiKey?: string;
}

@Injectable()
export class ApiKeysService {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  /**
   * Generate a new API key
   */
  private generateApiKey(): { key: string; prefix: string; hash: string } {
    // Generate random key: vce_<32 random chars>
    const randomBytes = crypto.randomBytes(16);
    const key = `vce_${randomBytes.toString("hex")}`;
    const prefix = key.substring(0, 11); // "vce_" + 7 chars
    const hash = bcrypt.hashSync(key, 10);

    return { key, prefix, hash };
  }

  /**
   * Create a new API key
   */
  async createApiKey(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<ApiKeyResponse> {
    const { key, prefix, hash } = this.generateApiKey();

    const [apiKey] = await this.db
      .insert(apiKeys)
      .values({
        userId,
        name: dto.name,
        keyHash: hash,
        keyPrefix: prefix,
        type: dto.type,
        expiresAt: dto.expiresAt,
        scopes: dto.scopes ? JSON.stringify(dto.scopes) : null,
        rateLimit: dto.rateLimit
          ? JSON.stringify(dto.rateLimit)
          : JSON.stringify({ requests: 1000, window: 3600 }),
        status: "active",
      })
      .returning();

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      type: apiKey.type,
      status: apiKey.status,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt || undefined,
      lastUsedAt: apiKey.lastUsedAt || undefined,
      apiKey: key, // Only returned on creation
    };
  }

  /**
   * List API keys for a user
   */
  async listApiKeys(userId: string): Promise<ApiKeyResponse[]> {
    const keys = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(apiKeys.createdAt);

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      type: key.type,
      status: key.status,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt || undefined,
      lastUsedAt: key.lastUsedAt || undefined,
    }));
  }

  /**
   * Get API key by ID
   */
  async getApiKey(userId: string, keyId: string): Promise<ApiKeyResponse> {
    const [key] = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .limit(1);

    if (!key) {
      throw new NotFoundException("API key not found");
    }

    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      type: key.type,
      status: key.status,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt || undefined,
      lastUsedAt: key.lastUsedAt || undefined,
    };
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(
    userId: string,
    keyId: string,
    revokedBy: string,
  ): Promise<void> {
    const [key] = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .limit(1);

    if (!key) {
      throw new NotFoundException("API key not found");
    }

    if (key.status === "revoked") {
      throw new BadRequestException("API key is already revoked");
    }

    await this.db
      .update(apiKeys)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        revokedBy,
      })
      .where(eq(apiKeys.id, keyId));
  }

  /**
   * Validate an API key
   */
  async validateApiKey(apiKey: string): Promise<{
    valid: boolean;
    key?: {
      id: string;
      userId: string;
      keyHash: string;
      type: string;
      status: string;
      expiresAt: Date | null;
      scopes: unknown;
      rateLimit: unknown;
    };
    user?: typeof users.$inferSelect;
  }> {
    // Get all active keys
    const keys = await this.db
      .select({
        id: apiKeys.id,
        userId: apiKeys.userId,
        keyHash: apiKeys.keyHash,
        type: apiKeys.type,
        status: apiKeys.status,
        expiresAt: apiKeys.expiresAt,
        scopes: apiKeys.scopes,
        rateLimit: apiKeys.rateLimit,
      })
      .from(apiKeys)
      .where(eq(apiKeys.status, "active"));

    // Check if key matches any hash
    for (const key of keys) {
      if (bcrypt.compareSync(apiKey, key.keyHash)) {
        // Check expiration
        if (key.expiresAt && key.expiresAt < new Date()) {
          // Mark as expired
          await this.db
            .update(apiKeys)
            .set({ status: "expired" })
            .where(eq(apiKeys.id, key.id));
          return { valid: false };
        }

        // Update last used
        await this.db
          .update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, key.id));

        // Get user
        const [user] = await this.db
          .select()
          .from(users)
          .where(eq(users.id, key.userId))
          .limit(1);

        return {
          valid: true,
          key: {
            ...key,
            scopes: key.scopes ? JSON.parse(key.scopes) : [],
            rateLimit: key.rateLimit ? JSON.parse(key.rateLimit) : null,
          },
          user,
        };
      }
    }

    return { valid: false };
  }
}
