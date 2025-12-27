import { Inject, Injectable } from "@nestjs/common";
import { eq, productVariants } from "@vcecom/db";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { VariantPricingDto } from "../dto/variant-pricing.dto";

/**
 * Service for managing variant pricing
 */
@Injectable()
export class VariantPricingService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Get effective price for a variant
   * Considers base price, sale price, and scheduled sales
   */
  async getEffectivePrice(
    variantId: string,
    now: Date = new Date(),
  ): Promise<number> {
    const [variant] = await this.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1);

    if (!variant) {
      throw new Error(`Variant ${variantId} not found`);
    }

    return this.calculateEffectivePrice(variant, now);
  }

  /**
   * Calculate effective price from variant data
   * Pure function - can be used by pricing engine
   */
  calculateEffectivePrice(
    variant: {
      price: number;
      salePrice?: number | null;
      saleStartDate?: Date | null;
      saleEndDate?: Date | null;
    },
    now: Date = new Date(),
  ): number {
    // Check if sale is active
    const isSaleActive =
      variant.salePrice !== null &&
      variant.salePrice !== undefined &&
      (!variant.saleStartDate || new Date(variant.saleStartDate) <= now) &&
      (!variant.saleEndDate || new Date(variant.saleEndDate) >= now);

    if (
      isSaleActive &&
      variant.salePrice !== null &&
      variant.salePrice !== undefined
    ) {
      return Math.max(0, variant.salePrice);
    }

    return Math.max(0, variant.price);
  }

  /**
   * Get full pricing information for a variant
   */
  async getVariantPricing(
    variantId: string,
    now: Date = new Date(),
  ): Promise<VariantPricingDto> {
    const [variant] = await this.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1);

    if (!variant) {
      throw new Error(`Variant ${variantId} not found`);
    }

    const isSaleActive =
      variant.salePrice !== null &&
      variant.salePrice !== undefined &&
      (!variant.saleStartDate || new Date(variant.saleStartDate) <= now) &&
      (!variant.saleEndDate || new Date(variant.saleEndDate) >= now);

    const effectivePrice = this.calculateEffectivePrice(variant, now);

    return {
      basePrice: variant.price,
      compareAtPrice: variant.compareAtPrice || undefined,
      currency: variant.currency || "INR",
      salePrice: variant.salePrice || undefined,
      saleStartDate: variant.saleStartDate || undefined,
      saleEndDate: variant.saleEndDate || undefined,
      isOnSale: isSaleActive,
      effectivePrice,
    };
  }

  /**
   * Check if variant is on sale
   */
  isVariantOnSale(
    variant: {
      salePrice?: number | null;
      saleStartDate?: Date | null;
      saleEndDate?: Date | null;
    },
    now: Date = new Date(),
  ): boolean {
    return (
      variant.salePrice !== null &&
      variant.salePrice !== undefined &&
      (!variant.saleStartDate || new Date(variant.saleStartDate) <= now) &&
      (!variant.saleEndDate || new Date(variant.saleEndDate) >= now)
    );
  }
}
