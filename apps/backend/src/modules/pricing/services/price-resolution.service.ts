import { Inject, Injectable } from "@nestjs/common";
import { customers, eq, products, productVariants } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import {
  DECIMAL_ROUNDING_MULTIPLIER,
  PERCENTAGE_MULTIPLIER,
} from "../../../common/constants/currency.constants";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { ResolvedPriceDto } from "../dto/resolved-price.dto";
import { runPricingEngine } from "../engine/pricing-engine";
import type {
  PriceList,
  VariantPricingInput,
} from "../engine/pricing-engine.types";
import { CustomerGroupService } from "./customer-group.service";
import { PriceListService } from "./price-list.service";

/**
 * Cache entry for price resolution
 */
interface PriceCacheEntry {
  result: ResolvedPriceDto;
  expiresAt: number;
}

/**
 * Service for resolving the best price for a variant given customer context
 * Integrates sale prices, price lists, and customer group pricing
 */
@Injectable()
export class PriceResolutionService {
  // In-memory cache for price resolutions (5 minute TTL)
  private readonly priceCache = new Map<string, PriceCacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly priceListService: PriceListService,
    private readonly customerGroupService: CustomerGroupService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    // Clean up expired cache entries every minute
    setInterval(() => this.cleanupCache(), 60 * 1000);
  }

  /**
   * Generate cache key for price resolution
   */
  private getCacheKey(params: {
    variantId: string;
    customerId?: string;
    customerGroupId?: string;
    quantity?: number;
    date?: Date;
  }): string {
    const dateKey = params.date
      ? params.date.toISOString().split("T")[0]
      : "today";
    return `price:${params.variantId}:${params.customerId || "guest"}:${params.customerGroupId || "none"}:${params.quantity || 1}:${dateKey}`;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.priceCache.entries()) {
      if (entry.expiresAt < now) {
        this.priceCache.delete(key);
      }
    }
  }

  /**
   * Resolve the best price for a variant given context
   * Priority: Sale price > Price list override > Base price
   */
  async resolveVariantPrice(params: {
    variantId: string;
    customerId?: string;
    customerGroupId?: string;
    quantity?: number;
    date?: Date;
  }): Promise<ResolvedPriceDto> {
    const {
      variantId,
      customerId,
      customerGroupId: providedCustomerGroupId,
      date = new Date(),
    } = params;

    // Check cache first
    const cacheKey = this.getCacheKey(params);
    const cached = this.priceCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    try {
      // Fetch variant with product and category info
      const variantData = await this.fetchVariantData(variantId);
      if (!variantData) {
        throw new Error(`Variant ${variantId} not found`);
      }

      // Determine customer group
      let effectiveCustomerGroupId: string | null = null;
      if (providedCustomerGroupId) {
        effectiveCustomerGroupId = providedCustomerGroupId;
      } else if (customerId) {
        effectiveCustomerGroupId = await this.getCustomerGroupId(customerId);
      }

      // Get applicable price lists for customer group
      const priceLists = await this.getApplicablePriceLists(
        effectiveCustomerGroupId,
        date,
      );

      // Prepare input for pricing engine
      const variantInput: VariantPricingInput = {
        variantId: variantData.variantId,
        productId: variantData.productId,
        categoryId: variantData.categoryId,
        basePrice: variantData.basePrice,
        compareAtPrice: variantData.compareAtPrice || undefined,
        salePrice: variantData.salePrice || undefined,
        saleStartDate: variantData.saleStartDate || undefined,
        saleEndDate: variantData.saleEndDate || undefined,
      };

      const engineInput = {
        variants: [variantInput],
        customer: customerId
          ? {
              id: customerId,
              customerGroupId: effectiveCustomerGroupId,
            }
          : null,
        priceLists: this.convertPriceListsForEngine(priceLists),
        now: date,
      };

      // Run pricing engine
      const engineResult = runPricingEngine(engineInput);
      const variantResult = engineResult.variantPrices[0];

      if (!variantResult) {
        throw new Error("Pricing engine returned no result");
      }

      // Build detailed breakdown
      const breakdown = this.buildPriceBreakdown(
        variantData,
        variantResult,
        priceLists,
        date,
      );

      // Get applied price list info
      const appliedPriceList = variantResult.appliedPriceListId
        ? await this.getPriceListInfo(variantResult.appliedPriceListId)
        : null;

      const result: ResolvedPriceDto = {
        finalPrice: variantResult.effectivePrice,
        basePrice: variantResult.basePrice,
        compareAtPrice: variantResult.compareAtPrice || null,
        breakdown,
        appliedPriceList: appliedPriceList
          ? {
              id: appliedPriceList.id,
              name: appliedPriceList.name,
              type: appliedPriceList.type,
            }
          : null,
      };

      // Cache the result
      this.priceCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });

      return result;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "PriceResolutionService.resolveVariantPrice",
          error,
          { variantId, customerId, date },
        ),
        "Failed to resolve variant price",
      );
      throw error;
    }
  }

  /**
   * Fetch variant data with product and category info
   */
  private async fetchVariantData(variantId: string) {
    try {
      const [variant] = await this.db
        .select({
          variantId: productVariants.id,
          productId: productVariants.productId,
          basePrice: productVariants.price,
          compareAtPrice: productVariants.compareAtPrice,
          salePrice: productVariants.salePrice,
          saleStartDate: productVariants.saleStartDate,
          saleEndDate: productVariants.saleEndDate,
          categoryId: products.categoryId,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(productVariants.id, variantId))
        .limit(1);

      return variant || null;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "PriceResolutionService.fetchVariantData",
          error,
          { variantId },
        ),
        "Failed to fetch variant data",
      );
      throw error;
    }
  }

  /**
   * Get customer group ID from customer ID
   */
  private async getCustomerGroupId(customerId: string): Promise<string | null> {
    try {
      const [customer] = await this.db
        .select({ customerGroupId: customers.customerGroupId })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      return customer?.customerGroupId || null;
    } catch (error) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "PriceResolutionService.getCustomerGroupId",
          {
            customerId,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
        "Failed to fetch customer group, continuing without group pricing",
      );
      return null;
    }
  }

  /**
   * Get applicable price lists for customer group
   */
  private async getApplicablePriceLists(
    customerGroupId: string | null,
    date: Date,
  ): Promise<Array<Awaited<ReturnType<typeof this.priceListService.findOne>>>> {
    if (!customerGroupId) {
      return [];
    }

    try {
      // Get price lists assigned to customer group
      const priceListAssignments =
        await this.customerGroupService.getPriceListsForGroup(customerGroupId);

      if (priceListAssignments.length === 0) {
        return [];
      }

      // Fetch all active price lists
      const activePriceLists = await this.priceListService.findActive(date);

      // Filter to only those assigned to the customer group
      const assignedPriceListIds = new Set(
        priceListAssignments.map((a) => a.priceListId),
      );

      return activePriceLists.filter((list) =>
        assignedPriceListIds.has(list.id),
      );
    } catch (error) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "PriceResolutionService.getApplicablePriceLists",
          {
            customerGroupId,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
        "Failed to fetch price lists, continuing without price list pricing",
      );
      return [];
    }
  }

  /**
   * Convert price list DTOs to engine format
   */
  private convertPriceListsForEngine(
    priceLists: Array<
      Awaited<ReturnType<typeof this.priceListService.findOne>>
    >,
  ): PriceList[] {
    return priceLists.map((list) => ({
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
        overrideType: item.overrideType,
        overrideValue: item.overrideValue,
      })),
    }));
  }

  /**
   * Build detailed price breakdown
   */
  private buildPriceBreakdown(
    variantData: {
      basePrice: number;
      compareAtPrice: number | null;
      salePrice: number | null;
      saleStartDate: Date | null;
      saleEndDate: Date | null;
    },
    variantResult: {
      basePrice: number;
      effectivePrice: number;
      salePrice?: number;
      isOnSale: boolean;
      appliedPriceListId?: string;
      appliedPriceListName?: string;
      priceListOverrides: Array<{
        priceListId: string;
        priceListName: string;
        overrideType: "FIXED" | "PERCENTAGE";
        overrideValue: number;
      }>;
    },
    priceLists: Array<
      Awaited<ReturnType<typeof this.priceListService.findOne>>
    >,
    date: Date,
  ): ResolvedPriceDto["breakdown"] {
    const basePrice = variantData.basePrice;
    const finalPrice = variantResult.effectivePrice;
    const totalSavings = basePrice - finalPrice;
    const savingsPercentage =
      basePrice > 0 ? (totalSavings / basePrice) * PERCENTAGE_MULTIPLIER : 0;

    // Check if sale is active
    const isSaleActive =
      variantData.salePrice !== null &&
      variantData.salePrice !== undefined &&
      (!variantData.saleStartDate ||
        new Date(variantData.saleStartDate) <= date) &&
      (!variantData.saleEndDate || new Date(variantData.saleEndDate) >= date);

    // Sale price info
    let salePriceInfo: ResolvedPriceDto["breakdown"]["salePrice"] = null;
    if (isSaleActive && variantData.salePrice !== null) {
      salePriceInfo = {
        amount: variantData.salePrice,
        startDate: variantData.saleStartDate || date,
        endDate: variantData.saleEndDate || date,
        label: "Sale",
      };
    }

    // Price list discount info
    let priceListDiscountInfo: ResolvedPriceDto["breakdown"]["priceListDiscount"] =
      null;
    if (
      variantResult.appliedPriceListId &&
      variantResult.priceListOverrides.length > 0
    ) {
      const bestOverride = variantResult.priceListOverrides[0];
      const priceList = priceLists.find(
        (pl) => pl.id === variantResult.appliedPriceListId,
      );

      if (priceList) {
        // Calculate price after override
        let priceAfterOverride = basePrice;
        if (bestOverride.overrideType === "FIXED") {
          priceAfterOverride = bestOverride.overrideValue;
        } else if (bestOverride.overrideType === "PERCENTAGE") {
          priceAfterOverride =
            basePrice * (1 - bestOverride.overrideValue / PERCENTAGE_MULTIPLIER);
        }

        // If sale is active, sale price wins, so discount is from base to sale
        // Otherwise, discount is from base to price list price
        const discountedPrice =
          isSaleActive && variantData.salePrice !== null
            ? variantData.salePrice
            : priceAfterOverride;
        const discountAmount = basePrice - discountedPrice;

        priceListDiscountInfo = {
          listName: bestOverride.priceListName,
          listId: bestOverride.priceListId,
          type: bestOverride.overrideType,
          amount: discountAmount,
          originalPrice: basePrice,
          discountedPrice,
        };
      }
    }

    return {
      basePrice,
      salePrice: salePriceInfo,
      priceListDiscount: priceListDiscountInfo,
      customerGroupDiscount: null, // Not directly calculated, included in price list
      totalSavings,
      savingsPercentage: Math.round(savingsPercentage * DECIMAL_ROUNDING_MULTIPLIER) / DECIMAL_ROUNDING_MULTIPLIER, // Round to 2 decimals
    };
  }

  /**
   * Get price list info by ID
   */
  private async getPriceListInfo(priceListId: string) {
    try {
      return await this.priceListService.findOne(priceListId);
    } catch (error) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "PriceResolutionService.getPriceListInfo",
          {
            priceListId,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
        "Failed to fetch price list info",
      );
      return null;
    }
  }
}
