import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { cartItems, eq, inArray, products, productVariants } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import { createLogContext } from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import type { Database } from "../../../../modules/database/db";
import { CartsService } from "../../../carts/carts.service";
import { BundleCartItemMetadata } from "../../../carts/dto/bundle-cart-item.dto";
import { DB_TOKEN } from "../../../database/database.module";

/**
 * Service responsible for fetching and processing cart data for order creation
 */
@Injectable()
export class OrderCartDataService {
  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
    private readonly cartsService: CartsService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Get cart and validate it's not empty
   */
  @Trace({ operation: "OrderCartDataService.getCartForOrder" })
  async getCartForOrder(cartId: string): Promise<{
    id: string;
    items: Array<{ id: string }>;
    discountCode?: string | null;
  }> {
    const cart = await this.cartsService.getCartById(cartId);
    if (!cart) {
      throw new BadRequestException("Cart not found");
    }
    // Defensive check: ensure items array exists and is not empty
    if (!cart.items || !Array.isArray(cart.items) || cart.items.length === 0) {
      this._logger.error(
        createLogContext(this._contextService, "getCartForOrder", {
          cartId,
          hasItems: !!cart.items,
          itemsType: typeof cart.items,
          itemsLength: cart.items?.length,
        }),
        "Cart items are missing or empty",
      );
      throw new BadRequestException("Cart is empty or items are missing");
    }
    return cart;
  }

  /**
   * Extract and separate cart items into bundles and variants
   */
  @Trace({ operation: "OrderCartDataService.extractCartItems" })
  async extractCartItems(cartItemIds: string[]): Promise<{
    bundleCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }>;
    variantCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }>;
    cartItemsWithVariants: Array<{
      cartItemId: string;
      productVariantId: string;
      quantity: number;
      price: number;
      productGstRate: number;
    }>;
  }> {
    if (cartItemIds.length === 0) {
      throw new BadRequestException("Cart items not found or invalid");
    }

    // Get cart items with metadata
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

    // Separate bundle and variant items
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
      const itemMetadata = item.metadata as BundleCartItemMetadata | null;
      if (itemMetadata?.type === "bundle") {
        bundleCartItems.push(item);
      } else {
        variantCartItems.push(item);
      }
    }

    // Get variant items with product details
    const variantItemIds = variantCartItems.map((i) => i.id);
    const cartItemsWithVariantsResult =
      variantItemIds.length > 0
        ? await this.db
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
            .where(inArray(cartItems.id, variantItemIds))
        : [];

    const cartItemsWithVariants = Array.isArray(cartItemsWithVariantsResult)
      ? cartItemsWithVariantsResult
      : [];

    return {
      bundleCartItems,
      variantCartItems,
      cartItemsWithVariants,
    };
  }
}
