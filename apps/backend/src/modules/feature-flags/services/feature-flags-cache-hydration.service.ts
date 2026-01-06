import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { featureFlagOverrides, featureFlags } from "@vcecom/db";
import Redis from "ioredis";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "../../../common/config/app.config.service";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../database/database.module";
import type { Database } from "../../database/db";
import { RedisStoreService } from "../../redis-store/redis-store.service";

const CACHE_TTL = 300; // 5 minutes in seconds

/**
 * Service for hydrating feature flags cache on application startup
 * Preloads all feature flags and their overrides into Redis cache
 */
@Injectable()
export class FeatureFlagsCacheHydrationService implements OnModuleInit {
  private redisClient: Redis | null = null;

  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly redisStoreService: RedisStoreService,
    private readonly configService: AppConfigService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    this.logger.info(
      createLogContext(this.contextService, "onModuleInit", {}),
      "Starting feature flags cache hydration in background (delayed 6s to serialize with other warmups)",
    );
    // Delay hydration to serialize with pricing/discount hydration and prevent connection pool saturation
    setTimeout(() => {
      // Run hydration in background - don't block startup
      this.hydrate()
        .then(() => {
          this.logger.info(
            createLogContext(this.contextService, "onModuleInit", {}),
            "Feature flags cache hydration completed successfully",
          );
        })
        .catch((error) => {
          // Don't block startup if hydration fails
          this.logger.error(
            createErrorContext(this.contextService, "onModuleInit", error),
            "Failed to hydrate feature flags cache on startup - will retry later",
          );
          this.logger.warn(
            createLogContext(this.contextService, "onModuleInit", {}),
            "Continuing startup without feature flags cache hydration, system will fallback to DB queries",
          );
        });
    }, 6000); // 6 second delay to serialize with pricing/discount hydration
  }

  /**
   * Get cache key for a feature flag resolution
   */
  private getCacheKey(
    featureKey: string,
    context: { adminId?: string; storeId?: string; env?: string },
  ): string {
    const { adminId = "", storeId = "", env = "" } = context;
    return `feature_flag:${featureKey}:${adminId}:${storeId}:${env}`;
  }

  /**
   * Hydrate all feature flags caches
   */
  async hydrate(): Promise<void> {
    try {
      if (!this.redisClient) {
        this.redisClient = await this.redisStoreService.getClient();
      }

      this.logger.info(
        createLogContext(this.contextService, "hydrate", {}),
        "Hydrating feature flags cache",
      );

      // Get all feature flags
      const allFeatures = await this.db.select().from(featureFlags);

      if (allFeatures.length === 0) {
        this.logger.info(
          createLogContext(this.contextService, "hydrate", {}),
          "No feature flags found, skipping cache hydration",
        );
        return;
      }

      // Get all overrides
      const allOverrides = await this.db.select().from(featureFlagOverrides);

      const env = this.configService.getNodeEnv();

      // Preload common contexts: default (no context), environment-level
      const contextsToWarm: Array<{
        adminId?: string;
        storeId?: string;
        env?: string;
      }> = [
        {}, // Default context
        { env }, // Environment-level context
      ];

      // Get unique admin IDs and store IDs from overrides
      const adminIds = new Set<string>();
      const storeIds = new Set<string>();
      const envOverrides = new Set<string>();

      for (const override of allOverrides) {
        if (override.scopeType === "admin" && override.scopeId) {
          adminIds.add(override.scopeId);
        } else if (override.scopeType === "store" && override.scopeId) {
          storeIds.add(override.scopeId);
        } else if (override.scopeType === "environment" && override.scopeId) {
          envOverrides.add(override.scopeId);
        }
      }

      // Add contexts for each admin (limit to first 100 to avoid too many cache entries)
      let adminCount = 0;
      for (const adminId of adminIds) {
        if (adminCount >= 100) break;
        contextsToWarm.push({ adminId, env });
        adminCount++;
      }

      // Add contexts for each store (limit to first 100)
      let storeCount = 0;
      for (const storeId of storeIds) {
        if (storeCount >= 100) break;
        contextsToWarm.push({ storeId, env });
        storeCount++;
      }

      // Add contexts for each environment override
      for (const envId of envOverrides) {
        contextsToWarm.push({ env: envId });
      }

      // Warm up cache for each feature flag in each context
      let warmedCount = 0;
      for (const feature of allFeatures) {
        for (const context of contextsToWarm) {
          try {
            const cacheKey = this.getCacheKey(feature.key, context);
            let resolvedState = feature.defaultState;

            // Check overrides in precedence order: admin > store > environment
            if (context.adminId) {
              const adminOverride = allOverrides.find(
                (o) =>
                  o.featureKey === feature.key &&
                  o.scopeType === "admin" &&
                  o.scopeId === context.adminId,
              );
              if (adminOverride) {
                resolvedState = adminOverride.state;
              }
            }

            if (!context.adminId && context.storeId) {
              const storeOverride = allOverrides.find(
                (o) =>
                  o.featureKey === feature.key &&
                  o.scopeType === "store" &&
                  o.scopeId === context.storeId,
              );
              if (storeOverride) {
                resolvedState = storeOverride.state;
              }
            }

            if (!context.adminId && !context.storeId && context.env) {
              const envOverride = allOverrides.find(
                (o) =>
                  o.featureKey === feature.key &&
                  o.scopeType === "environment" &&
                  o.scopeId === context.env,
              );
              if (envOverride) {
                resolvedState = envOverride.state;
              }
            }

            // Cache the resolved state
            await this.redisClient.setex(
              cacheKey,
              CACHE_TTL,
              resolvedState ? "true" : "false",
            );
            warmedCount++;
          } catch (error) {
            this.logger.warn(
              createErrorContext(this.contextService, "hydrate", error, {
                featureKey: feature.key,
                context,
              }),
              "Failed to warm up cache for feature flag context",
            );
          }
        }
      }

      this.logger.info(
        createLogContext(this.contextService, "hydrate", {
          featureCount: allFeatures.length,
          overrideCount: allOverrides.length,
          contextCount: contextsToWarm.length,
          warmedCount,
        }),
        "Feature flags cache hydration completed",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "hydrate", error),
        "Failed to hydrate feature flags cache",
      );
      throw error;
    }
  }
}
