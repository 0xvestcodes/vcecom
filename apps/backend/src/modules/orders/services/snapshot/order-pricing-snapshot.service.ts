import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { PricingSnapshot } from "../../../pricing/engine/pricing-engine.types";
import { PricingSnapshotDto } from "../../dto/enriched-order-item.dto";

/**
 * Service responsible for preparing variant items with pricing snapshots
 */
@Injectable()
export class OrderPricingSnapshotService {
  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
  ) {}

  /**
   * Prepare variant items with pricing snapshots
   */
  @Trace({ operation: "OrderPricingSnapshotService.prepareVariantItems" })
  prepareVariantItemsWithPricing(
    cartItemsWithVariants: Array<{
      cartItemId: string;
      productVariantId: string;
      quantity: number;
      price: number;
      productGstRate: number;
    }>,
    pricingSnapshot: PricingSnapshot | null,
  ): Array<{
    productVariantId: string;
    quantity: number;
    price: number;
    productGstRate: number;
    pricingSnapshot?: PricingSnapshotDto;
  }> {
    // Validate input
    if (!cartItemsWithVariants || !Array.isArray(cartItemsWithVariants)) {
      return [];
    }

    return cartItemsWithVariants.map((item) => {
      // Validate item structure
      if (!item || typeof item !== "object") {
        throw new Error(`Invalid cart item: ${JSON.stringify(item)}`);
      }

      // Ensure required fields exist with defaults
      const productVariantId = item.productVariantId || "";
      const quantity =
        typeof item.quantity === "number" && item.quantity > 0
          ? item.quantity
          : 1;
      const price =
        typeof item.price === "number" && item.price >= 0 ? item.price : 0;
      const productGstRate =
        typeof item.productGstRate === "number" && item.productGstRate >= 0
          ? item.productGstRate
          : 0;
      let itemPrice = price;
      let pricingSnapshotDto: PricingSnapshotDto | undefined;

      if (
        pricingSnapshot?.variantPrices &&
        Array.isArray(pricingSnapshot.variantPrices)
      ) {
        const variantPrice = pricingSnapshot.variantPrices.find(
          (vp) => vp.variantId === productVariantId,
        );
        if (variantPrice) {
          itemPrice = variantPrice.effectivePrice;

          // Store detailed pricing snapshot in order item metadata
          const basePrice = variantPrice.basePrice;
          const compareAtPrice = variantPrice.compareAtPrice;
          const effectivePrice = variantPrice.effectivePrice;
          const savings = basePrice - effectivePrice;

          pricingSnapshotDto = {
            basePrice,
            compareAtPrice: compareAtPrice || null,
            appliedSale:
              variantPrice.isOnSale && variantPrice.salePrice
                ? { amount: variantPrice.salePrice, label: "Sale Price" }
                : undefined,
            appliedPriceList:
              variantPrice.appliedPriceListId &&
              variantPrice.appliedPriceListName
                ? {
                    name: variantPrice.appliedPriceListName,
                    amount: basePrice - effectivePrice,
                  }
                : undefined,
            savings,
          };
        }
      }

      return {
        productVariantId,
        quantity,
        price: itemPrice,
        productGstRate,
        pricingSnapshot: pricingSnapshotDto,
      };
    });
  }

  /**
   * Prepare variant items with pricing (simplified version without detailed snapshot)
   */
  @Trace({ operation: "OrderPricingSnapshotService.prepareVariantItemsSimple" })
  prepareVariantItemsWithPricingSimple(
    cartItemsWithVariants: Array<{
      productVariantId: string;
      quantity: number;
      price: number;
      productGstRate: number;
    }>,
    pricingSnapshot: PricingSnapshot | null,
  ): Array<{
    productVariantId: string;
    quantity: number;
    price: number;
    productGstRate: number;
  }> {
    return cartItemsWithVariants.map((item) => {
      let itemPrice = item.price;
      if (pricingSnapshot) {
        const variantPrice = pricingSnapshot.variantPrices.find(
          (vp) => vp.variantId === item.productVariantId,
        );
        if (variantPrice) {
          itemPrice = variantPrice.effectivePrice;
        }
      }
      return {
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        price: itemPrice,
        productGstRate: item.productGstRate,
      };
    });
  }
}
