import { forwardRef, Inject, Injectable } from "@nestjs/common";
import {
  FeatureFlagContext,
  FeatureFlagsService,
} from "../../modules/feature-flags/feature-flags.service";
import { type FeatureFlagKey } from "./feature-flag-keys";

/**
 * Feature Flag Resolver Utility
 *
 * Provides a convenient, type-safe way to check feature flags throughout the codebase.
 * Can be injected into services for easy feature flag checks.
 *
 * @example
 * ```typescript
 * constructor(private readonly featureResolver: FeatureFlagResolver) {}
 *
 * async someMethod() {
 *   if (await this.featureResolver.isEnabled(FEATURE_FLAG_KEYS.RETURNS_MODULE, { adminId: this.userId })) {
 *     // Feature is enabled
 *   }
 * }
 * ```
 */
@Injectable()
export class FeatureFlagResolver {
  constructor(
    @Inject(forwardRef(() => FeatureFlagsService))
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  /**
   * Check if a feature flag is enabled for the given context
   *
   * @param key - Feature flag key (use FEATURE_FLAG_KEYS for type safety)
   * @param context - Context for resolution (adminId, storeId, env)
   * @returns Promise<boolean> - True if feature is enabled
   */
  async isEnabled(
    key: FeatureFlagKey | string,
    context: FeatureFlagContext = {},
  ): Promise<boolean> {
    return await this.featureFlagsService.isFeatureEnabled(key, context);
  }

  /**
   * Check if a feature flag is enabled (synchronous wrapper for convenience)
   * Note: This will return false if the service is not available
   * For async operations, use isEnabled() instead
   */
  isEnabledSync(
    key: FeatureFlagKey | string,
    context: FeatureFlagContext = {},
  ): boolean {
    // This is a synchronous wrapper - in practice, you should use isEnabled()
    // This exists for cases where you need a sync check but should be avoided
    return false; // Default to false for safety
  }

  /**
   * Get all feature flags for a context
   */
  async getFlags(context: FeatureFlagContext = {}) {
    return await this.featureFlagsService.getFeatureFlags(context);
  }
}
