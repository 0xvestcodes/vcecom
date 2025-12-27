import { Inject, Injectable } from "@nestjs/common";
import {
  inArray,
  or,
  productCollections,
  products,
  productTags,
  productVariants,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { DiscountScope } from "../dto/create-discount.dto";
import { DiscountResponseDto } from "../dto/discount-response.dto";

@Injectable()
export class DiscountEligibilityBuilder {
  constructor(
    private readonly logger: PinoLogger,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Build eligibility set for a discount (returns variant IDs)
   */
  async buildEligibilityForDiscount(
    discount: DiscountResponseDto,
  ): Promise<string[]> {
    try {
      // For cart-level discounts (ORDER scope), eligibility is based on cart total
      // Return empty array - eligibility will be checked at cart level
      if (discount.scope === DiscountScope.ORDER) {
        return [];
      }

      // For product-level discounts, find eligible variants
      const eligibleProductIds = await this.findEligibleProducts(discount);

      if (eligibleProductIds.length === 0) {
        return [];
      }

      // Get all variants for eligible products
      const variants = await this.db
        .select({ variantId: productVariants.id })
        .from(productVariants)
        .where(inArray(productVariants.productId, eligibleProductIds));

      return variants.map((v) => v.variantId);
    } catch (error) {
      this.logger.error(
        `Failed to build eligibility for discount ${discount.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Build eligibility for multiple discounts (batch)
   */
  async buildEligibilityForDiscounts(
    discounts: DiscountResponseDto[],
  ): Promise<Map<string, string[]>> {
    const eligibilityMap = new Map<string, string[]>();

    for (const discount of discounts) {
      try {
        const variantIds = await this.buildEligibilityForDiscount(discount);
        eligibilityMap.set(discount.id, variantIds);
      } catch (error) {
        this.logger.error(
          `Failed to build eligibility for discount ${discount.id}, skipping: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        // Continue with other discounts
      }
    }

    return eligibilityMap;
  }

  /**
   * Find eligible product IDs for a discount based on filters
   */
  private async findEligibleProducts(
    discount: DiscountResponseDto,
  ): Promise<string[]> {
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle ORM condition array type
    const conditions: any[] = [];

    // If discount has no specific filters, it applies to all products
    const hasSpecificFilters =
      (discount.productIds && discount.productIds.length > 0) ||
      (discount.categoryIds && discount.categoryIds.length > 0) ||
      (discount.collectionIds && discount.collectionIds.length > 0) ||
      (discount.tagIds && discount.tagIds.length > 0);

    if (!hasSpecificFilters) {
      // Get all active products
      const allProducts = await this.db
        .select({ id: products.id })
        .from(products);
      return allProducts.map((p) => p.id);
    }

    // Check product IDs
    if (discount.productIds && discount.productIds.length > 0) {
      conditions.push(inArray(products.id, discount.productIds));
    }

    // Check category IDs
    if (discount.categoryIds && discount.categoryIds.length > 0) {
      conditions.push(inArray(products.categoryId, discount.categoryIds));
    }

    // Check collection IDs (via product_collections junction)
    if (discount.collectionIds && discount.collectionIds.length > 0) {
      const productsInCollections = await this.db
        .select({ productId: productCollections.productId })
        .from(productCollections)
        .where(
          inArray(productCollections.collectionId, discount.collectionIds),
        );

      const productIdsFromCollections = productsInCollections.map(
        (pc) => pc.productId,
      );

      if (productIdsFromCollections.length > 0) {
        conditions.push(inArray(products.id, productIdsFromCollections));
      } else {
        // No products in collections, return empty
        return [];
      }
    }

    // Check tag IDs (via product_tags junction)
    if (discount.tagIds && discount.tagIds.length > 0) {
      const productsWithTags = await this.db
        .select({ productId: productTags.productId })
        .from(productTags)
        .where(inArray(productTags.tagId, discount.tagIds));

      const productIdsFromTags = productsWithTags.map((pt) => pt.productId);

      if (productIdsFromTags.length > 0) {
        conditions.push(inArray(products.id, productIdsFromTags));
      } else {
        // No products with tags, return empty
        return [];
      }
    }

    // Query products matching any condition (OR logic)
    if (conditions.length === 0) {
      return [];
    }

    const matchingProducts = await this.db
      .select({ id: products.id })
      .from(products)
      .where(or(...conditions));

    // Remove duplicates
    const uniqueProductIds = Array.from(
      new Set(matchingProducts.map((p) => p.id)),
    );

    return uniqueProductIds;
  }
}
