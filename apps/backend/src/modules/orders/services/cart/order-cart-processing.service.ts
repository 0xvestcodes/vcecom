import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  cartItems,
  eq,
  inArray,
  productCollections,
  products,
  productTags,
  productVariants,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import { Trace } from "../../../../common/tracing/trace.decorator";
import type { Database } from "../../../../modules/database/db";
import { BundleCartItemMetadata } from "../../../carts/dto/bundle-cart-item.dto";
import { DB_TOKEN } from "../../../database/database.module";
import { BundlePricingService } from "../../../pricing/services/bundle-pricing.service";

/**
 * Service responsible for processing cart items
 * Handles cart item extraction, separation of bundles/variants, and product data fetching
 */
@Injectable()
export class OrderCartProcessingService {
  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly bundlePricingService: BundlePricingService,
  ) {}

  /**
   * Extract cart items with metadata
   */
  @Trace({ operation: "OrderCartProcessingService.extractCartItems" })
  async extractCartItems(cartItemIds: string[]): Promise<
    Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }>
  > {
    if (cartItemIds.length === 0) {
      return [];
    }

    const allCartItems = await this.db
      .select({
        id: cartItems.id,
        productVariantId: cartItems.productVariantId,
        quantity: cartItems.quantity,
        price: cartItems.price,
        metadata: cartItems.metadata,
      })
      .from(cartItems)
      .where(inArray(cartItems.id, cartItemIds));

    if (allCartItems.length === 0) {
      throw new BadRequestException("Cart items not found or invalid");
    }

    return allCartItems;
  }

  /**
   * Separate bundle and variant cart items
   */
  @Trace({ operation: "OrderCartProcessingService.separateItems" })
  separateBundleAndVariantItems(
    allCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }>,
  ): {
    bundleItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }>;
    variantItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }>;
  } {
    const bundleCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }> = [];
    const variantCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }> = [];

    for (const item of allCartItems) {
      const metadata = item.metadata as BundleCartItemMetadata | null;
      if (metadata?.type === "bundle") {
        bundleCartItems.push(item);
      } else {
        variantCartItems.push(item);
      }
    }

    return {
      bundleItems: bundleCartItems,
      variantItems: variantCartItems,
    };
  }

  /**
   * Fetch cart items with product/variant data
   */
  @Trace({ operation: "OrderCartProcessingService.fetchCartItemProductData" })
  async fetchCartItemProductData(variantItemIds: string[]): Promise<
    Array<{
      cartItemId: string;
      productVariantId: string;
      quantity: number;
      price: number;
      productGstRate: number;
    }>
  > {
    if (variantItemIds.length === 0) {
      return [];
    }

    const cartItemsWithVariantsResult = await this.db
      .select({
        cartItemId: cartItems.id,
        productVariantId: cartItems.productVariantId,
        quantity: cartItems.quantity,
        price: cartItems.price,
        productGstRate: products.gstRate,
      })
      .from(cartItems)
      .innerJoin(
        productVariants,
        eq(cartItems.productVariantId, productVariants.id),
      )
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(inArray(cartItems.id, variantItemIds));

    return Array.isArray(cartItemsWithVariantsResult)
      ? cartItemsWithVariantsResult
      : [];
  }

  /**
   * Process bundle items and extract variant quantities
   */
  @Trace({ operation: "OrderCartProcessingService.processBundleItems" })
  async processBundleItems(
    bundleItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }>,
  ): Promise<{
    bundleVariantMapping: Map<string, string[]>;
    flattenedBundleVariants: Array<{
      variantId: string;
      productId: string;
      categoryId: string | null;
      basePrice: number;
      quantity: number;
      bundleLineId: string;
    }>;
  }> {
    const bundleVariantMapping = new Map<string, string[]>();
    const flattenedBundleVariants: Array<{
      variantId: string;
      productId: string;
      categoryId: string | null;
      basePrice: number;
      quantity: number;
      bundleLineId: string;
    }> = [];

    for (const bundleItem of bundleItems) {
      const metadata = bundleItem.metadata as BundleCartItemMetadata;
      const variantQuantities =
        this.bundlePricingService.flattenBundleSelections(
          metadata.selections,
          bundleItem.quantity,
        );

      const bundleVariantIds: string[] = [];
      for (const vq of variantQuantities) {
        const [variant] = await this.db
          .select({
            productId: productVariants.productId,
          })
          .from(productVariants)
          .where(eq(productVariants.id, vq.variantId))
          .limit(1);

        if (variant) {
          bundleVariantIds.push(vq.variantId);
          const [product] = await this.db
            .select({
              categoryId: products.categoryId,
            })
            .from(products)
            .where(eq(products.id, variant.productId))
            .limit(1);

          // Get unit price from bundle breakdown
          const unitPrice = bundleItem.price / variantQuantities.length;
          flattenedBundleVariants.push({
            variantId: vq.variantId,
            productId: variant.productId,
            categoryId: product?.categoryId || null,
            basePrice: unitPrice,
            quantity: vq.quantity,
            bundleLineId: bundleItem.id,
          });
        }
      }
      bundleVariantMapping.set(bundleItem.id, bundleVariantIds);
    }

    return {
      bundleVariantMapping,
      flattenedBundleVariants,
    };
  }

  /**
   * Fetch product collections and tags for pricing engine
   */
  @Trace({
    operation: "OrderCartProcessingService.fetchProductCollectionsAndTags",
  })
  async fetchProductCollectionsAndTags(productIds: string[]): Promise<{
    collectionsByProduct: Map<string, string[]>;
    tagsByProduct: Map<string, string[]>;
  }> {
    if (productIds.length === 0) {
      return {
        collectionsByProduct: new Map(),
        tagsByProduct: new Map(),
      };
    }

    // Fetch product collections
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

    // Fetch product tags
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

    return {
      collectionsByProduct,
      tagsByProduct,
    };
  }
}
