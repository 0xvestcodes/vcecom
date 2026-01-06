import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import {
  featureFlagAuditLogs,
  featureFlagOverrides,
  featureFlags,
} from "@vcecom/db";
import { and, desc, eq } from "drizzle-orm";
import Redis from "ioredis";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "../../common/config/app.config.service";
import { DB_TOKEN } from "../database/database.module";
import type { Database } from "../database/db";
import { RedisStoreService } from "../redis-store/redis-store.service";

export interface FeatureFlagContext {
  adminId?: string;
  storeId?: string;
  env?: string;
}

export interface CreateFeatureFlagDto {
  key: string;
  description: string;
  type?: "global" | "store" | "admin" | "env";
  defaultState?: boolean;
}

export interface SetFeatureFlagDto {
  state: boolean;
  reason?: string;
}

export interface FeatureFlagResponse {
  key: string;
  description: string;
  type: string;
  defaultState: boolean;
  currentState: boolean;
  activeScope?: {
    type: "admin" | "store" | "environment";
    id: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagHistoryEntry {
  id: string;
  featureKey: string;
  scopeType?: string;
  scopeId?: string;
  oldState?: boolean;
  newState: boolean;
  changedBy: string;
  changeReason?: string;
  createdAt: Date;
}

const CACHE_TTL = 300; // 5 minutes in seconds

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  private redisClient: Redis | null = null;

  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly redisStoreService: RedisStoreService,
    private readonly configService: AppConfigService,
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit() {
    try {
      this.redisClient = await this.redisStoreService.getClient();
    } catch (_error) {
      this.logger.warn(
        "Failed to initialize Redis client for feature flags - caching disabled",
      );
    }
  }

  /**
   * Get cache key for a feature flag resolution
   */
  private getCacheKey(featureKey: string, context: FeatureFlagContext): string {
    const { adminId = "", storeId = "", env = "" } = context;
    return `feature_flag:${featureKey}:${adminId}:${storeId}:${env}`;
  }

  /**
   * Invalidate cache for a feature flag (all contexts)
   */
  private async invalidateCache(featureKey: string): Promise<void> {
    if (!this.redisClient) return;

    try {
      // Use pattern matching to find all cache keys for this feature
      const pattern = `feature_flag:${featureKey}:*`;
      const stream = this.redisClient.scanStream({
        match: pattern,
        count: 100,
      });

      const keys: string[] = [];
      stream.on("data", (resultKeys: string[]) => {
        keys.push(...resultKeys);
      });

      await new Promise<void>((resolve, reject) => {
        stream.on("end", () => resolve());
        stream.on("error", reject);
      });

      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } catch (error) {
      this.logger.warn("Failed to invalidate feature flag cache", error);
    }
  }

  /**
   * Core resolver function - checks if a feature is enabled
   * Implements precedence: admin > store > env > default
   */
  async isFeatureEnabled(
    featureKey: string,
    context: FeatureFlagContext = {},
  ): Promise<boolean> {
    // Get environment from config if not provided
    const env = context.env || this.configService.getNodeEnv();

    // Check cache first
    const cacheKey = this.getCacheKey(featureKey, { ...context, env });
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached !== null) {
          return cached === "true";
        }
      } catch (error) {
        this.logger.warn("Failed to read from cache", error);
      }
    }

    // Get feature definition
    const [feature] = await this.db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, featureKey))
      .limit(1);

    if (!feature) {
      // Feature not defined - default to false
      return false;
    }

    let resolvedState = feature.defaultState;
    let activeScope:
      | { type: "admin" | "store" | "environment"; id: string }
      | undefined;

    // Check overrides in precedence order: admin > store > environment
    if (context.adminId) {
      const [adminOverride] = await this.db
        .select()
        .from(featureFlagOverrides)
        .where(
          and(
            eq(featureFlagOverrides.featureKey, featureKey),
            eq(featureFlagOverrides.scopeType, "admin"),
            eq(featureFlagOverrides.scopeId, context.adminId),
          ),
        )
        .limit(1);

      if (adminOverride) {
        resolvedState = adminOverride.state;
        activeScope = { type: "admin", id: context.adminId };
      }
    }

    // Check store override if no admin override
    if (!activeScope && context.storeId) {
      const [storeOverride] = await this.db
        .select()
        .from(featureFlagOverrides)
        .where(
          and(
            eq(featureFlagOverrides.featureKey, featureKey),
            eq(featureFlagOverrides.scopeType, "store"),
            eq(featureFlagOverrides.scopeId, context.storeId),
          ),
        )
        .limit(1);

      if (storeOverride) {
        resolvedState = storeOverride.state;
        activeScope = { type: "store", id: context.storeId };
      }
    }

    // Check environment override if no admin or store override
    if (!activeScope && env) {
      const [envOverride] = await this.db
        .select()
        .from(featureFlagOverrides)
        .where(
          and(
            eq(featureFlagOverrides.featureKey, featureKey),
            eq(featureFlagOverrides.scopeType, "environment"),
            eq(featureFlagOverrides.scopeId, env),
          ),
        )
        .limit(1);

      if (envOverride) {
        resolvedState = envOverride.state;
        activeScope = { type: "environment", id: env };
      }
    }

    // Cache the result
    if (this.redisClient) {
      try {
        await this.redisClient.setex(
          cacheKey,
          CACHE_TTL,
          resolvedState ? "true" : "false",
        );
      } catch (error) {
        this.logger.warn("Failed to cache feature flag", error);
      }
    }

    return resolvedState;
  }

  /**
   * Get all feature flags with their resolved states for a context
   */
  async getFeatureFlags(
    context: FeatureFlagContext = {},
  ): Promise<FeatureFlagResponse[]> {
    const allFeatures = await this.db.select().from(featureFlags);

    const results: FeatureFlagResponse[] = [];

    for (const feature of allFeatures) {
      const currentState = await this.isFeatureEnabled(feature.key, context);

      // Determine active scope
      let activeScope:
        | { type: "admin" | "store" | "environment"; id: string }
        | undefined;
      const env = context.env || this.configService.getNodeEnv();

      if (context.adminId) {
        const [adminOverride] = await this.db
          .select()
          .from(featureFlagOverrides)
          .where(
            and(
              eq(featureFlagOverrides.featureKey, feature.key),
              eq(featureFlagOverrides.scopeType, "admin"),
              eq(featureFlagOverrides.scopeId, context.adminId),
            ),
          )
          .limit(1);

        if (adminOverride) {
          activeScope = { type: "admin", id: context.adminId };
        }
      }

      if (!activeScope && context.storeId) {
        const [storeOverride] = await this.db
          .select()
          .from(featureFlagOverrides)
          .where(
            and(
              eq(featureFlagOverrides.featureKey, feature.key),
              eq(featureFlagOverrides.scopeType, "store"),
              eq(featureFlagOverrides.scopeId, context.storeId),
            ),
          )
          .limit(1);

        if (storeOverride) {
          activeScope = { type: "store", id: context.storeId };
        }
      }

      if (!activeScope && env) {
        const [envOverride] = await this.db
          .select()
          .from(featureFlagOverrides)
          .where(
            and(
              eq(featureFlagOverrides.featureKey, feature.key),
              eq(featureFlagOverrides.scopeType, "environment"),
              eq(featureFlagOverrides.scopeId, env),
            ),
          )
          .limit(1);

        if (envOverride) {
          activeScope = { type: "environment", id: env };
        }
      }

      results.push({
        key: feature.key,
        description: feature.description,
        type: feature.type,
        defaultState: feature.defaultState,
        currentState,
        activeScope,
        createdAt: feature.createdAt,
        updatedAt: feature.updatedAt,
      });
    }

    return results;
  }

  /**
   * Create a new feature flag definition
   */
  async createFeatureFlag(
    dto: CreateFeatureFlagDto,
    userId: string,
  ): Promise<FeatureFlagResponse> {
    // Validate key format (alphanumeric + underscores)
    if (!/^[a-z0-9_]+$/.test(dto.key)) {
      throw new BadRequestException(
        "Feature key must contain only lowercase letters, numbers, and underscores",
      );
    }

    try {
      const [feature] = await this.db
        .insert(featureFlags)
        .values({
          key: dto.key,
          description: dto.description,
          type: dto.type || "global",
          defaultState: dto.defaultState ?? false,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      return {
        key: feature.key,
        description: feature.description,
        type: feature.type,
        defaultState: feature.defaultState,
        currentState: feature.defaultState,
        createdAt: feature.createdAt,
        updatedAt: feature.updatedAt,
      };
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      ) {
        // Unique constraint violation
        throw new BadRequestException(
          `Feature flag with key "${dto.key}" already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * List all feature flags
   */
  async listFeatureFlags(): Promise<FeatureFlagResponse[]> {
    const features = await this.db.select().from(featureFlags);

    return features.map((feature) => ({
      key: feature.key,
      description: feature.description,
      type: feature.type,
      defaultState: feature.defaultState,
      currentState: feature.defaultState,
      createdAt: feature.createdAt,
      updatedAt: feature.updatedAt,
    }));
  }

  /**
   * Set a feature flag override for a specific scope
   */
  async setFeatureFlag(
    featureKey: string,
    scopeType: "admin" | "store" | "environment",
    scopeId: string,
    state: boolean,
    userId: string,
    reason?: string,
  ): Promise<void> {
    // Verify feature exists
    const [feature] = await this.db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, featureKey))
      .limit(1);

    if (!feature) {
      throw new NotFoundException(`Feature flag "${featureKey}" not found`);
    }

    // Get existing override to track old state for audit
    const [existing] = await this.db
      .select()
      .from(featureFlagOverrides)
      .where(
        and(
          eq(featureFlagOverrides.featureKey, featureKey),
          eq(featureFlagOverrides.scopeType, scopeType),
          eq(featureFlagOverrides.scopeId, scopeId),
        ),
      )
      .limit(1);

    const oldState = existing?.state;

    // Upsert override
    if (existing) {
      await this.db
        .update(featureFlagOverrides)
        .set({
          state,
          updatedAt: new Date(),
        })
        .where(eq(featureFlagOverrides.id, existing.id));
    } else {
      await this.db.insert(featureFlagOverrides).values({
        featureKey,
        scopeType,
        scopeId,
        state,
        createdBy: userId,
      });
    }

    // Log audit event
    await this.db.insert(featureFlagAuditLogs).values({
      featureKey,
      scopeType,
      scopeId,
      oldState: oldState ?? null,
      newState: state,
      changedBy: userId,
      changeReason: reason || null,
    });

    // Invalidate cache
    await this.invalidateCache(featureKey);
  }

  /**
   * Remove a feature flag override
   */
  async removeFeatureFlag(
    featureKey: string,
    scopeType: "admin" | "store" | "environment",
    scopeId: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    // Get existing override to track old state for audit
    const [existing] = await this.db
      .select()
      .from(featureFlagOverrides)
      .where(
        and(
          eq(featureFlagOverrides.featureKey, featureKey),
          eq(featureFlagOverrides.scopeType, scopeType),
          eq(featureFlagOverrides.scopeId, scopeId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Feature flag override not found");
    }

    // Get feature default state for audit log
    const [feature] = await this.db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, featureKey))
      .limit(1);

    const newState = feature?.defaultState ?? false;

    // Delete override
    await this.db
      .delete(featureFlagOverrides)
      .where(eq(featureFlagOverrides.id, existing.id));

    // Log audit event
    await this.db.insert(featureFlagAuditLogs).values({
      featureKey,
      scopeType,
      scopeId,
      oldState: existing.state,
      newState,
      changedBy: userId,
      changeReason: reason || null,
    });

    // Invalidate cache
    await this.invalidateCache(featureKey);
  }

  /**
   * Update the default state of a feature flag
   * This updates the global default state, not a scoped override
   */
  async updateDefaultState(
    featureKey: string,
    newDefaultState: boolean,
    userId: string,
    reason?: string,
  ): Promise<FeatureFlagResponse> {
    // Verify feature exists and get current state
    const [feature] = await this.db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, featureKey))
      .limit(1);

    if (!feature) {
      throw new NotFoundException(`Feature flag "${featureKey}" not found`);
    }

    const oldDefaultState = feature.defaultState;

    // If state hasn't changed, return early
    if (oldDefaultState === newDefaultState) {
      return {
        key: feature.key,
        description: feature.description,
        type: feature.type,
        defaultState: feature.defaultState,
        currentState: await this.isFeatureEnabled(feature.key, {}),
        createdAt: feature.createdAt,
        updatedAt: feature.updatedAt,
      };
    }

    // Update default state
    const [updated] = await this.db
      .update(featureFlags)
      .set({
        defaultState: newDefaultState,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.key, featureKey))
      .returning();

    // Log audit event (using scopeType null to indicate default state change)
    await this.db.insert(featureFlagAuditLogs).values({
      featureKey,
      scopeType: null,
      scopeId: null,
      oldState: oldDefaultState,
      newState: newDefaultState,
      changedBy: userId,
      changeReason: reason || null,
    });

    // Invalidate cache for all contexts
    await this.invalidateCache(featureKey);

    // Get current resolved state
    const currentState = await this.isFeatureEnabled(feature.key, {});

    return {
      key: updated.key,
      description: updated.description,
      type: updated.type,
      defaultState: updated.defaultState,
      currentState,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Get audit history for a feature flag
   */
  async getFeatureFlagHistory(
    featureKey: string,
    scopeType?: "admin" | "store" | "environment",
    scopeId?: string,
  ): Promise<FeatureFlagHistoryEntry[]> {
    const conditions = [eq(featureFlagAuditLogs.featureKey, featureKey)];

    if (scopeType) {
      conditions.push(eq(featureFlagAuditLogs.scopeType, scopeType));
    }

    if (scopeId) {
      conditions.push(eq(featureFlagAuditLogs.scopeId, scopeId));
    }

    const logs = await this.db
      .select()
      .from(featureFlagAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(featureFlagAuditLogs.createdAt))
      .limit(100);

    return logs.map((log) => ({
      id: log.id,
      featureKey: log.featureKey,
      scopeType: log.scopeType || undefined,
      scopeId: log.scopeId || undefined,
      oldState: log.oldState ?? undefined,
      newState: log.newState,
      changedBy: log.changedBy,
      changeReason: log.changeReason || undefined,
      createdAt: log.createdAt,
    }));
  }
}
