import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DiscountRuleStore } from "../../redis-store/stores/discount-rule-store";
import { EligibilityStore } from "../../redis-store/stores/eligibility-store";
import { ProductMappingStore } from "../../redis-store/stores/product-mapping-store";
import { DiscountsService } from "../discounts.service";
import { DiscountEligibilityBuilder } from "./discount-eligibility-builder.service";
import { ProductMappingBuilder } from "./product-mapping-builder.service";
import { RulesetRebuilder } from "./ruleset-rebuilder.service";

@Injectable()
export class DiscountWarmupWorker {
  constructor(
    private readonly discountsService: DiscountsService,
    private readonly discountRuleStore: DiscountRuleStore,
    private readonly eligibilityStore: EligibilityStore,
    private readonly eligibilityBuilder: DiscountEligibilityBuilder,
    private readonly productMappingStore: ProductMappingStore,
    private readonly productMappingBuilder: ProductMappingBuilder,
    private readonly rulesetRebuilder: RulesetRebuilder,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Periodic cache refresh worker (runs at 5 and 35 minutes past each hour)
   * Staggered to avoid concurrent execution with pricing warmup
   */
  @Cron("5,35 * * * *")
  async handleWarmup() {
    this.logger.debug(
      createLogContext(this.contextService, "handleWarmup", {}),
      "Starting discount cache warmup",
    );
    try {
      await this.warmup();
      this.logger.debug(
        createLogContext(this.contextService, "handleWarmup", {}),
        "Discount cache warmup completed successfully",
      );
    } catch (error) {
      // Don't throw - log and continue
      this.logger.error(
        createErrorContext(this.contextService, "handleWarmup", error),
        "Failed to run discount cache warmup",
      );
    }
  }

  /**
   * Warmup discount caches
   */
  async warmup(): Promise<void> {
    try {
      // Use ruleset rebuilder for atomic hot reload
      const newVersion = await this.rulesetRebuilder.rebuildFromDb();
      this.logger.debug(
        createLogContext(this.contextService, "warmup", {
          version: newVersion,
        }),
        "Refreshed discount ruleset",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "warmup", error),
        "Failed to rebuild ruleset during warmup",
      );
      // Fallback to legacy warmup method
      this.logger.warn(
        createLogContext(this.contextService, "warmup", {}),
        "Falling back to legacy warmup method",
      );
      await this.warmupLegacy();
    }
  }

  /**
   * Legacy warmup method (fallback)
   */
  private async warmupLegacy(): Promise<void> {
    // STEP 1: Recompute active discount rules
    const allDiscounts = await this.loadActiveDiscountsFromDb();
    await this.discountRuleStore.storeRules(allDiscounts);
    this.logger.debug(
      createLogContext(this.contextService, "warmupLegacy", {
        discountCount: allDiscounts.length,
      }),
      "Refreshed discount rules",
    );

    // STEP 2: Rehydrate eligibility sets
    await this.refreshEligibilitySets(allDiscounts);
    this.logger.debug(
      createLogContext(this.contextService, "warmupLegacy", {}),
      "Refreshed eligibility sets",
    );

    // STEP 3: Refresh product mappings
    await this.refreshProductMappings(allDiscounts);
    this.logger.debug(
      createLogContext(this.contextService, "warmupLegacy", {}),
      "Refreshed product mappings",
    );

    // STEP 4: Detect stale or invalid rules (optional - log warnings)
    await this.detectStaleRules(allDiscounts);
  }

  /**
   * Load active discounts from database
   */
  private async loadActiveDiscountsFromDb() {
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
   * Refresh eligibility sets for all discounts
   */
  // biome-ignore lint/suspicious/noExplicitAny: DiscountResponseDto[] type
  private async refreshEligibilitySets(discounts: any[]): Promise<void> {
    const eligibilityMap =
      await this.eligibilityBuilder.buildEligibilityForDiscounts(discounts);

    for (const [discountId, variantIds] of eligibilityMap.entries()) {
      try {
        await this.eligibilityStore.storeEligibility(discountId, variantIds);
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "refreshEligibilitySets",
            error,
            { discountId },
          ),
          "Failed to refresh eligibility for discount",
        );
        // Continue with other discounts
      }
    }
  }

  /**
   * Refresh product mappings
   */
  // biome-ignore lint/suspicious/noExplicitAny: DiscountResponseDto[] type
  private async refreshProductMappings(discounts: any[]): Promise<void> {
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

    const mappings = await this.productMappingBuilder.buildMappingsBatch(
      Array.from(productIds),
    );

    for (const [productId, mapping] of mappings.entries()) {
      try {
        await this.productMappingStore.storeProductMapping(productId, mapping);
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "refreshProductMappings",
            error,
            { productId },
          ),
          "Failed to refresh product mapping for product",
        );
        // Continue with other products
      }
    }
  }

  /**
   * Detect stale or invalid rules
   */
  // biome-ignore lint/suspicious/noExplicitAny: DiscountResponseDto[] type
  private async detectStaleRules(discounts: any[]): Promise<void> {
    // Check for discounts that should be active but aren't in cache
    // This is a monitoring/logging function
    const cachedRules = await this.discountRuleStore.getRules();
    if (cachedRules) {
      const cachedIds = new Set(cachedRules.map((r) => r.id));
      const activeIds = new Set(discounts.map((d) => d.id));

      // Find missing discounts
      const missing = discounts.filter((d) => !cachedIds.has(d.id));
      if (missing.length > 0) {
        this.logger.warn(
          createLogContext(this.contextService, "detectStaleRules", {
            missingCount: missing.length,
            missingCodes: missing.map((d) => d.code),
          }),
          "Found active discounts not in cache",
        );
      }

      // Find stale discounts (in cache but not active)
      const stale = cachedRules.filter((r) => !activeIds.has(r.id));
      if (stale.length > 0) {
        this.logger.warn(
          createLogContext(this.contextService, "detectStaleRules", {
            staleCount: stale.length,
            staleCodes: stale.map((r) => r.code),
          }),
          "Found stale discounts in cache",
        );
      }
    }
  }
}
