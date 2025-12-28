import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { cartItems, inArray } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import type { Database } from "../../../../modules/database/db";
import { CartsService } from "../../../carts/carts.service";
import { BundleCartItemMetadata } from "../../../carts/dto/bundle-cart-item.dto";
import { DB_TOKEN } from "../../../database/database.module";

/**
 * Service responsible for cart validation and error handling
 * Centralizes all cart validation logic used during order creation
 */
@Injectable()
export class OrderCartValidationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly cartsService: CartsService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Validate that cart exists and has items
   * @throws BadRequestException if cart is empty or not found
   */
  @Trace({ operation: "OrderCartValidationService.validateCartExists" })
  async validateCartExists(cartId: string): Promise<void> {
    const cart = await this.cartsService.getCartById(cartId);

    if (!cart) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateCartExists",
          new Error("Cart not found"),
          { cartId },
        ),
        "Cart validation failed: cart not found",
      );
      throw new BadRequestException("Cart not found");
    }

    if (!cart.items || cart.items.length === 0) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateCartExists",
          new Error("Cart is empty"),
          { cartId, itemsCount: cart.items?.length || 0 },
        ),
        "Cart validation failed: cart is empty",
      );
      throw new BadRequestException("Cart is empty");
    }
  }

  /**
   * Validate that cart items exist and are valid
   * @throws BadRequestException if cart items are not found or invalid
   */
  @Trace({ operation: "OrderCartValidationService.validateCartItems" })
  async validateCartItems(cartItemIds: string[]): Promise<void> {
    if (cartItemIds.length === 0) {
      throw new BadRequestException("Cart item IDs array is empty");
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
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateCartItems",
          new Error("Cart items not found"),
          { cartItemIds, foundItems: 0 },
        ),
        "Cart items validation failed: no items found",
      );
      throw new BadRequestException("Cart items not found or invalid");
    }

    // Validate that all requested items were found
    const foundItemIds = new Set(allCartItems.map((item) => item.id));
    const missingItemIds = cartItemIds.filter((id) => !foundItemIds.has(id));

    if (missingItemIds.length > 0) {
      this.logger.warn(
        createLogContext(this.contextService, "validateCartItems", {
          cartItemIds,
          missingItemIds,
          foundItems: allCartItems.length,
        }),
        "Some cart items were not found",
      );
      // Don't throw error here - log warning and continue with found items
      // This allows for graceful handling of concurrent cart modifications
    }

    // Validate item quantities
    for (const item of allCartItems) {
      if (item.quantity <= 0) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "validateCartItems",
            new Error("Invalid cart item quantity"),
            {
              cartItemId: item.id,
              quantity: item.quantity,
            },
          ),
          "Cart item validation failed: invalid quantity",
        );
        throw new BadRequestException(
          `Cart item ${item.id} has invalid quantity: ${item.quantity}`,
        );
      }

      if (item.price < 0) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "validateCartItems",
            new Error("Invalid cart item price"),
            {
              cartItemId: item.id,
              price: item.price,
            },
          ),
          "Cart item validation failed: invalid price",
        );
        throw new BadRequestException(
          `Cart item ${item.id} has invalid price: ${item.price}`,
        );
      }
    }
  }

  /**
   * Validate cart and get cart data
   * Combines cart existence validation with cart retrieval
   * @returns Cart object if valid
   * @throws BadRequestException if cart is invalid
   */
  @Trace({ operation: "OrderCartValidationService.validateAndGetCart" })
  async validateAndGetCart(cartId: string) {
    await this.validateCartExists(cartId);
    const cart = await this.cartsService.getCartById(cartId);

    if (!cart) {
      // This should not happen after validateCartExists, but handle it anyway
      throw new BadRequestException("Cart not found after validation");
    }

    return cart;
  }

  /**
   * Validate cart items and return them
   * Combines cart items validation with retrieval
   * @returns Array of cart items if valid
   * @throws BadRequestException if cart items are invalid
   */
  @Trace({ operation: "OrderCartValidationService.validateAndGetCartItems" })
  async validateAndGetCartItems(cartItemIds: string[]) {
    await this.validateCartItems(cartItemIds);

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

    return allCartItems;
  }

  /**
   * Separate bundle and variant items from cart items
   * Validates item metadata structure
   */
  @Trace({
    operation: "OrderCartValidationService.separateBundleAndVariantItems",
  })
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
      try {
        const itemMetadata = item.metadata as BundleCartItemMetadata | null;
        if (itemMetadata?.type === "bundle") {
          bundleCartItems.push(item);
        } else {
          variantCartItems.push(item);
        }
      } catch (error) {
        // If metadata parsing fails, treat as variant item
        this.logger.warn(
          createLogContext(
            this.contextService,
            "separateBundleAndVariantItems",
            {
              cartItemId: item.id,
              error: error instanceof Error ? error.message : String(error),
            },
          ),
          "Failed to parse cart item metadata, treating as variant item",
        );
        variantCartItems.push(item);
      }
    }

    return {
      bundleItems: bundleCartItems,
      variantItems: variantCartItems,
    };
  }
}
