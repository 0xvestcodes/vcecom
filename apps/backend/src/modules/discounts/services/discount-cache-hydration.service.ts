import { Injectable, OnModuleInit } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { TracingService } from "../../../common/tracing/tracing.service";
import { DiscountRuleStore } from "../../redis-store/stores/discount-rule-store";
import { EligibilityStore } from "../../redis-store/stores/eligibility-store";
import { ProductMappingStore } from "../../redis-store/stores/product-mapping-store";
import { DiscountsService } from "../discounts.service";
import { DiscountEligibilityBuilder } from "./discount-eligibility-builder.service";
import { ProductMappingBuilder } from "./product-mapping-builder.service";
import { RulesetRebuilder } from "./ruleset-rebuilder.service";
import { RulesetVersionManager } from "./ruleset-version-manager.service";

@Injectable()
export class DiscountCacheHydrationService implements OnModuleInit {
  constructor(
    private readonly discountsService: DiscountsService,
    private readonly discountRuleStore: DiscountRuleStore,
    private readonly eligibilityStore: EligibilityStore,
    private readonly eligibilityBuilder: DiscountEligibilityBuilder,
    private readonly productMappingStore: ProductMappingStore,
    private readonly productMappingBuilder: ProductMappingBuilder,
    private readonly rulesetRebuilder: RulesetRebuilder,
    private readonly versionManager: RulesetVersionManager,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly tracingService: TracingService,
  ) {}

  /**
   * Bootstrap Redis caches on app startup
   * Runs in background to avoid blocking app startup
   * Delayed by 3 seconds to serialize with pricing hydration and prevent connection pool saturation
   */
  async onModuleInit() {
    this.logger.info(
      createLogContext(this.contextService, "onModuleInit", {}),
      "Starting discount cache hydration in background (delayed 3s to serialize DB load)",
    );
    // Delay hydration to serialize with pricing hydration and prevent connection pool saturation
    setTimeout(() => {
      // Run hydration in background - don't block startup
      this.hydrate()
        .then(() => {
          this.logger.info(
            createLogContext(this.contextService, "onModuleInit", {}),
            "Discount cache hydration completed successfully",
          );
        })
        .catch((error) => {
          // Don't block startup if hydration fails
          this.logger.error(
            createErrorContext(this.contextService, "onModuleInit", error),
            "Failed to hydrate discount caches on startup - will retry later",
          );
          this.logger.warn(
            createLogContext(this.contextService, "onModuleInit", {}),
            "Continuing startup without discount cache hydration, system will fallback to DB queries",
          );
        });
    }, 3000); // 3 second delay to serialize with pricing hydration
  }

  /**
   * Hydrate all discount caches
   */
  async hydrate(): Promise<void> {
    return this.tracingService
      .startSpan({
        operation: "DiscountCacheHydrationService.hydrate",
        logLifecycle: true,
      })
      .execute(async () => {
        this.logger.info(
          createLogContext(this.contextService, "hydrate", {}),
          "Hydrating discount caches",
        );

        // STEP 1: Initialize version if not exists
        try {
          const currentVersion = await this.versionManager.getCurrentVersion();
          this.logger.info(
            createLogContext(this.contextService, "hydrate", {
              currentVersion,
            }),
            "Current ruleset version",
          );
        } catch (_error) {
          // Version will be initialized by versionManager if not exists
          this.logger.debug(
            createLogContext(this.contextService, "hydrate", {}),
            "Version not initialized yet, will be created on first bundle",
          );
        }

        // STEP 2: Rebuild bundle from DB (this creates versioned bundle with eligibility + mappings)
        try {
          const newVersion = await this.rulesetRebuilder.rebuildFromDb();
          this.logger.info(
            createLogContext(this.contextService, "hydrate", {
              version: newVersion,
            }),
            "Successfully hydrated discount caches with bundle",
          );
        } catch (error) {
          this.logger.error(
            createErrorContext(this.contextService, "hydrate", error),
            "Failed to rebuild bundle during hydration",
          );
          // Fallback to old method for backward compatibility
          this.logger.warn(
            createLogContext(this.contextService, "hydrate", {}),
            "Falling back to legacy cache hydration method",
          );
          await this.hydrateLegacy();
        }

        this.logger.info(
          createLogContext(this.contextService, "hydrate", {}),
          "Discount cache hydration completed",
        );
      });
  }

  /**
   * Legacy hydration method (fallback)
   */
  private async hydrateLegacy(): Promise<void> {
    // Load all active discounts from DB
    const allDiscounts = await this.loadActiveDiscountsFromDb();
    this.logger.info(
      createLogContext(this.contextService, "hydrateLegacy", {
        discountCount: allDiscounts.length,
      }),
      "Loaded active discounts from DB",
    );

    if (allDiscounts.length === 0) {
      this.logger.info(
        createLogContext(this.contextService, "hydrateLegacy", {}),
        "No active discounts found, skipping cache hydration",
      );
      return;
    }

    // Store discount rules in Redis (legacy key)
    await this.discountRuleStore.storeRules(allDiscounts);
    this.logger.info(
      createLogContext(this.contextService, "hydrateLegacy", {}),
      "Stored discount rules in Redis (legacy)",
    );

    // Build and store eligibility sets
    await this.hydrateEligibilitySets(allDiscounts);
    this.logger.info(
      createLogContext(this.contextService, "hydrateLegacy", {}),
      "Hydrated eligibility sets",
    );

    // Build and store product mappings
    await this.hydrateProductMappings(allDiscounts);
    this.logger.info(
      createLogContext(this.contextService, "hydrateLegacy", {}),
      "Hydrated product mappings",
    );
  }

  /**
   * Load active discounts from database
   */
  private async loadActiveDiscountsFromDb() {
    // Get all discounts and enrich with relations
    const discounts = await this.discountsService.findAllUnpaginated();
    const now = new Date();
    return discounts.filter((d) => {
      if (!d.isActive) {
        return false;
      }
      if (d.startDate > now) {
        return false; // Not started yet
      }
      if (d.endDate && d.endDate < now) {
        return false; // Expired
      }
      return true;
    });
  }

  /**
   * Hydrate eligibility sets for all discounts
   */
  // biome-ignore lint/suspicious/noExplicitAny: DiscountResponseDto[] type
  private async hydrateEligibilitySets(discounts: any[]): Promise<void> {
    const eligibilityMap =
      await this.eligibilityBuilder.buildEligibilityForDiscounts(discounts);

    for (const [discountId, variantIds] of eligibilityMap.entries()) {
      try {
        await this.eligibilityStore.storeEligibility(discountId, variantIds);
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "hydrateEligibilitySets",
            error,
            { discountId },
          ),
          "Failed to store eligibility for discount",
        );
        // Continue with other discounts
      }
    }
  }

  /**
   * Hydrate product mappings for products referenced in discounts
   */
  // biome-ignore lint/suspicious/noExplicitAny: DiscountResponseDto[] type
  private async hydrateProductMappings(discounts: any[]): Promise<void> {
    // Collect all unique product IDs from discounts
    const productIds = new Set<string>();

    for (const discount of discounts) {
      if (discount.productIds && discount.productIds.length > 0) {
        for (const productId of discount.productIds) {
          productIds.add(productId);
        }
      }
    }

    if (productIds.size === 0) {
      return;
    }

    // Build mappings in batch
    const mappings = await this.productMappingBuilder.buildMappingsBatch(
      Array.from(productIds),
    );

    // Store mappings
    for (const [productId, mapping] of mappings.entries()) {
      try {
        await this.productMappingStore.storeProductMapping(productId, mapping);
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "hydrateProductMappings",
            error,
            { productId },
          ),
          "Failed to store product mapping for product",
        );
        // Continue with other products
      }
    }
  }
}
