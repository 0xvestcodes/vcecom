import { Inject, Injectable } from "@nestjs/common";
import { productVariants } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { PriceList } from "../engine/pricing-engine.types";
import { PriceListService } from "./price-list.service";
import { PricingBundleService } from "./pricing-bundle.service";
import { PricingVersionManager } from "./pricing-version-manager.service";

@Injectable()
export class PricingRebuilder {
  private isRebuilding = false;

  constructor(
    private readonly priceListService: PriceListService,
    private readonly bundleService: PricingBundleService,
    private readonly versionManager: PricingVersionManager,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Rebuild bundle from provided data and atomically activate it
   */
  async rebuildAndActivate(
    variants?: Array<{
      variantId: string;
      productId: string;
      categoryId: string | null;
      basePrice: number;
      compareAtPrice?: number;
      currency: string;
      salePrice?: number;
      saleStartDate?: Date;
      saleEndDate?: Date;
    }>,
    priceLists?: PriceList[],
  ): Promise<number> {
    if (this.isRebuilding) {
      this.logger.debug(
        createLogContext(this.contextService, "rebuildAndActivate", {}),
        "Rebuild already in progress, skipping new request",
      );
      return this.versionManager.getCurrentVersion();
    }

    this.isRebuilding = true;
    try {
      this.logger.info(
        createLogContext(this.contextService, "rebuildAndActivate", {}),
        "Starting pricing ruleset rebuild and activation",
      );

      const allVariants = variants || (await this.loadVariantsFromDb());
      const allPriceLists = priceLists || (await this.loadPriceListsFromDb());

      if (allVariants.length === 0) {
        this.logger.warn(
          createLogContext(this.contextService, "rebuildAndActivate", {
            variantCount: 0,
          }),
          "No variants found for rebuild",
        );
        return this.versionManager.getCurrentVersion();
      }

      // STEP 1: Build new bundle (this stores it with a new version suffix)
      const newBundleMetadata = await this.bundleService.buildBundle(
        allVariants,
        allPriceLists,
      );

      // STEP 2: Atomically activate the new bundle by incrementing the global version
      await this.bundleService.activateBundle(newBundleMetadata.version);

      this.logger.info(
        createLogContext(this.contextService, "rebuildAndActivate", {
          version: newBundleMetadata.version,
        }),
        "Successfully rebuilt and activated pricing bundle",
      );

      // Trigger cleanup of old bundles (non-blocking)
      this.bundleService.cleanupOldBundles();

      return newBundleMetadata.version;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "rebuildAndActivate", error),
        "Failed to rebuild and activate pricing bundle",
      );
      return this.versionManager.getCurrentVersion();
    } finally {
      this.isRebuilding = false;
    }
  }

  /**
   * Rebuild bundle from database
   */
  async rebuildFromDb(): Promise<number> {
    return this.rebuildAndActivate();
  }

  /**
   * Load variants from database
   */
  private async loadVariantsFromDb(): Promise<
    Array<{
      variantId: string;
      productId: string;
      categoryId: string | null;
      basePrice: number;
      compareAtPrice?: number;
      currency: string;
      salePrice?: number;
      saleStartDate?: Date;
      saleEndDate?: Date;
    }>
  > {
    const variants = await this.db.select().from(productVariants);

    // Get product category IDs (simplified - you may need to join with products table)
    return variants.map((v) => ({
      variantId: v.id,
      productId: v.productId,
      categoryId: null, // TODO: Join with products to get categoryId
      basePrice: v.price,
      compareAtPrice: v.compareAtPrice || undefined,
      currency: v.currency || "INR",
      salePrice: v.salePrice || undefined,
      saleStartDate: v.saleStartDate || undefined,
      saleEndDate: v.saleEndDate || undefined,
    }));
  }

  /**
   * Load active price lists from database
   */
  private async loadPriceListsFromDb(): Promise<PriceList[]> {
    const now = new Date();
    const activeLists = await this.priceListService.findActive(now);

    // Convert to PriceList format
    return activeLists.map((list) => ({
      id: list.id,
      name: list.name,
      type: list.type,
      priority: list.priority,
      isActive: list.isActive,
      startDate: list.startDate || undefined,
      endDate: list.endDate || undefined,
      items: list.items.map((item) => ({
        id: item.id,
        productVariantId: item.productVariantId || undefined,
        productId: item.productId || undefined,
        categoryId: item.categoryId || undefined,
        overrideType: item.overrideType as "FIXED" | "PERCENTAGE",
        overrideValue: item.overrideValue,
      })),
    }));
  }
}
