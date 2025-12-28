import { Inject, Injectable } from "@nestjs/common";
import { inArray, productCollections, productTags } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { DB_TOKEN } from "../../../database/database.module";
import type { Database } from "../../../database/db";
import { DiscountSnapshot } from "../../../discounts/engine/discount-engine.types";
import { OrderDiscountService } from "../discount/order-discount.service";

/**
 * Service responsible for discount engine integration
 * Handles preparation of cart items for discount engine and discount application
 */
@Injectable()
export class OrderDiscountEngineService {
  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
    private readonly discountService: OrderDiscountService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Prepare cart items for discount engine and apply discounts
   */
  @Trace({ operation: "OrderDiscountEngineService.applyDiscounts" })
  async applyDiscounts(
    cartId: string,
    checkoutSessionId: string | null,
    effectiveSubtotal: number,
    customerId: string | null,
    userId: string | null,
    discountCode: string | null,
    shippingCost: number,
    cartItemsWithVariants: Array<{
      cartItemId: string;
      productVariantId: string;
      quantity: number;
      price: number;
      productGstRate: number;
    }>,
    bundleCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }>,
    bundleVariantMapping: Map<string, string[]>,
    flattenedBundleVariants: Array<{
      variantId: string;
      productId: string;
      categoryId: string | null;
      basePrice: number;
      quantity: number;
      bundleLineId: string;
    }>,
    variantProductMap: Array<{
      variantId: string;
      productId: string;
    }>,
    productDetails: Array<{
      productId: string;
      categoryId: string | null;
    }>,
  ): Promise<{
    discountAmount: number;
    discountSnapshot: DiscountSnapshot | null;
  }> {
    // Fetch collections for products
    const productIds = Array.from(
      new Set(variantProductMap.map((v) => v.productId)),
    );
    const productCollectionData = await this.db
      .select({
        productId: productCollections.productId,
        collectionId: productCollections.collectionId,
      })
      .from(productCollections)
      .where(inArray(productCollections.productId, productIds));

    const collectionsByProduct = new Map<string, string[]>();
    for (const pc of productCollectionData) {
      if (!collectionsByProduct.has(pc.productId)) {
        collectionsByProduct.set(pc.productId, []);
      }
      collectionsByProduct.get(pc.productId)?.push(pc.collectionId);
    }

    // Fetch tags for products
    const productTagData = await this.db
      .select({
        productId: productTags.productId,
        tagId: productTags.tagId,
      })
      .from(productTags)
      .where(inArray(productTags.productId, productIds));

    const tagsByProduct = new Map<string, string[]>();
    for (const pt of productTagData) {
      if (!tagsByProduct.has(pt.productId)) {
        tagsByProduct.set(pt.productId, []);
      }
      tagsByProduct.get(pt.productId)?.push(pt.tagId);
    }

    const variantToProduct = new Map(
      variantProductMap.map((v) => [v.variantId, v.productId]),
    );
    const productMap = new Map(productDetails.map((p) => [p.productId, p]));

    // Build cart items for discount engine (variants + flattened bundles)
    const variantItemsForEngine = cartItemsWithVariants.map((item) => {
      const productId = variantToProduct.get(item.productVariantId);
      const product = productId ? productMap.get(productId) : null;
      return {
        id: item.cartItemId,
        productVariantId: item.productVariantId,
        productId: productId || "",
        categoryId: product?.categoryId || null,
        collectionIds: productId
          ? collectionsByProduct.get(productId) || []
          : [],
        tagIds: productId ? tagsByProduct.get(productId) || [] : [],
        price: item.price,
        quantity: item.quantity,
      };
    });

    // Add flattened bundle items to discount engine
    const flattenedBundleItemsForEngine = flattenedBundleVariants.map((v) => {
      const productId = variantToProduct.get(v.variantId);
      return {
        id: `${v.bundleLineId}-${v.variantId}`, // Unique ID for flattened item
        productVariantId: v.variantId,
        productId: v.productId,
        categoryId: v.categoryId,
        collectionIds: productId
          ? collectionsByProduct.get(productId) || []
          : [],
        tagIds: productId ? tagsByProduct.get(productId) || [] : [],
        price: v.basePrice,
        quantity: v.quantity,
      };
    });

    const cartItemsForEngine = [
      ...variantItemsForEngine,
      ...flattenedBundleItemsForEngine,
    ];

    // Apply discounts using discount service
    const result = await this.discountService.applyDiscountsToOrder(
      cartId,
      checkoutSessionId,
      effectiveSubtotal,
      customerId,
      userId,
      discountCode,
      shippingCost,
      cartItemsForEngine,
      bundleCartItems,
      bundleVariantMapping,
      flattenedBundleVariants,
    );

    return result;
  }
}
