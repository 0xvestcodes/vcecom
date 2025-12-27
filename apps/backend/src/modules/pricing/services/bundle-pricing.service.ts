import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { customers, eq, inArray, products, productVariants } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  BundleEligibilityService,
  UserBundleSelection,
} from "../../bundles/services/bundle-eligibility.service";
import { runPricingEngine } from "../engine/pricing-engine";
import {
  PriceList,
  PricingEngineInput,
  VariantPricingInput,
} from "../engine/pricing-engine.types";
import { CustomerGroupService } from "./customer-group.service";
import { PriceListService } from "./price-list.service";

export interface BundleVariantBreakdown {
  variantId: string;
  unitPrice: number;
  quantity: number;
}

@Injectable()
export class BundlePricingService {
  constructor(
    private readonly bundleEligibilityService: BundleEligibilityService,
    private readonly priceListService: PriceListService,
    private readonly customerGroupService: CustomerGroupService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Calculate bundle price using sum-of-parts pricing
   * Bundle price = sum(prices of selected variants) * bundleQuantity
   */
  async calculateBundlePrice(
    bundleId: string,
    selections: UserBundleSelection,
    bundleQuantity: number,
    customerId: string | null,
  ): Promise<number> {
    const breakdown = await this.getBundleVariantBreakdown(
      bundleId,
      selections,
      bundleQuantity,
      customerId,
    );

    // Sum all variant prices
    const totalPrice = breakdown.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    return totalPrice;
  }

  /**
   * Get detailed breakdown of bundle variants with pricing
   */
  async getBundleVariantBreakdown(
    bundleId: string,
    selections: UserBundleSelection,
    bundleQuantity: number,
    customerId: string | null,
  ): Promise<BundleVariantBreakdown[]> {
    // Get bundle definition
    const bundle = await this.bundleEligibilityService.getBundle(bundleId);
    if (!bundle) {
      throw new NotFoundException(`Bundle with ID ${bundleId} not found`);
    }

    // Flatten selections to variant list with quantities
    const variantQuantities = this.flattenBundleSelections(
      selections,
      bundleQuantity,
    );

    // Get customer group for price list resolution
    const customerGroupId = customerId
      ? await this.getCustomerGroupId(customerId)
      : null;

    // Get active price lists for customer group
    const activePriceLists =
      await this.getPriceListsForCustomer(customerGroupId);

    // Get variant details from database with product category
    const variantIds = Array.from(
      new Set(variantQuantities.map((v) => v.variantId)),
    );

    if (variantIds.length === 0) {
      throw new NotFoundException("No variants found in bundle selections");
    }

    const variants = await this.db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        categoryId: products.categoryId,
        price: productVariants.price,
        salePrice: productVariants.salePrice,
        saleStartDate: productVariants.saleStartDate,
        saleEndDate: productVariants.saleEndDate,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(inArray(productVariants.id, variantIds));

    // Build variant map
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Build pricing input
    const variantPricingInput: VariantPricingInput[] = variantQuantities.map(
      (vq) => {
        const variant = variantMap.get(vq.variantId);
        if (!variant) {
          throw new NotFoundException(`Variant ${vq.variantId} not found`);
        }

        return {
          variantId: variant.id,
          productId: variant.productId,
          categoryId: variant.categoryId,
          basePrice: Number(variant.price),
          salePrice: variant.salePrice ? Number(variant.salePrice) : undefined,
          saleStartDate: variant.saleStartDate || undefined,
          saleEndDate: variant.saleEndDate || undefined,
        };
      },
    );

    // Run pricing engine
    const pricingInput: PricingEngineInput = {
      variants: variantPricingInput,
      customer: customerId
        ? {
            id: customerId,
            customerGroupId,
          }
        : null,
      priceLists: activePriceLists,
      now: new Date(),
    };

    const pricingResult = runPricingEngine(pricingInput);

    // Build breakdown from pricing results
    const breakdown: BundleVariantBreakdown[] = variantQuantities.map((vq) => {
      const pricingResultItem = pricingResult.variantPrices.find(
        (vp) => vp.variantId === vq.variantId,
      );

      if (!pricingResultItem) {
        throw new Error(`Pricing result not found for variant ${vq.variantId}`);
      }

      return {
        variantId: vq.variantId,
        unitPrice: pricingResultItem.effectivePrice,
        quantity: vq.quantity,
      };
    });

    return breakdown;
  }

  /**
   * Flatten bundle selections to variant quantities
   * Returns array of {variantId, quantity} where quantity = selectionQuantity * bundleQuantity
   */
  flattenBundleSelections(
    selections: UserBundleSelection,
    bundleQuantity: number,
  ): Array<{ variantId: string; quantity: number }> {
    const variantMap = new Map<string, number>();

    // Aggregate quantities per variant across all sets
    for (const [_setId, variantIds] of Object.entries(selections)) {
      for (const variantId of variantIds) {
        const currentQty = variantMap.get(variantId) || 0;
        variantMap.set(variantId, currentQty + bundleQuantity);
      }
    }

    return Array.from(variantMap.entries()).map(([variantId, quantity]) => ({
      variantId,
      quantity,
    }));
  }

  /**
   * Get customer group ID from customer ID
   */
  private async getCustomerGroupId(customerId: string): Promise<string | null> {
    try {
      const [customer] = await this.db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);
      return customer?.customerGroupId || null;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getCustomerGroupId", error, {
          customerId,
        }),
        "Failed to get customer group",
      );
      return null;
    }
  }

  /**
   * Get price lists for a customer (based on customer group)
   */
  private async getPriceListsForCustomer(
    customerGroupId: string | null,
  ): Promise<PriceList[]> {
    try {
      if (!customerGroupId) {
        // No customer group, return empty price lists
        return [];
      }

      const group = await this.customerGroupService.findOne(customerGroupId);
      const priceListIds = group.priceLists.map((pl) => pl.priceListId);

      if (priceListIds.length === 0) {
        return [];
      }

      const priceLists = await Promise.all(
        priceListIds.map((id) => this.priceListService.findOne(id)),
      );

      // Convert to PricingEngineInput format
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
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "getPriceListsForCustomer",
          error,
          { customerGroupId: customerGroupId || undefined },
        ),
        "Failed to get price lists for customer",
      );
      return [];
    }
  }
}
