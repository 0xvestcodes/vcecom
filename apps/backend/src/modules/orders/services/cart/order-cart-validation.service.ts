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
 * Validates cart existence, emptiness, and item validity before order creation
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
   * Validate cart exists and is not empty
   * @throws BadRequestException if cart is empty or not found
   */
  @Trace({ operation: "OrderCartValidationService.validateCartNotEmpty" })
  validateCartNotEmpty(
    cart: {
      id: string;
      items?: Array<{ id: string }> | null;
    } | null,
  ): void {
    if (!cart || !cart.items || cart.items.length === 0) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateCartNotEmpty",
          new Error("Cart is empty or not found"),
          { cartId: cart?.id },
        ),
        "Cart validation failed: cart is empty or not found",
      );
      throw new BadRequestException("Cart is empty or not found");
    }
  }

  /**
   * Validate cart items exist and are valid
   * @throws BadRequestException if cart items are not found or invalid
   */
  @Trace({ operation: "OrderCartValidationService.validateCartItems" })
  validateCartItems(
    cartItemIds: string[],
    allCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }>,
  ): void {
    if (allCartItems.length === 0) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateCartItems",
          new Error("Cart items not found or invalid"),
          { cartItemIds },
        ),
        "Cart items validation failed: no items found",
      );
      throw new BadRequestException("Cart items not found or invalid");
    }

    // Validate each cart item has required fields
    for (const item of allCartItems) {
      if (!item.productVariantId) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "validateCartItems",
            new Error("Cart item missing productVariantId"),
            { cartItemId: item.id },
          ),
          "Cart item validation failed: missing productVariantId",
        );
        throw new BadRequestException(
          `Cart item ${item.id} is missing productVariantId`,
        );
      }

      if (!item.quantity || item.quantity <= 0) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "validateCartItems",
            new Error("Cart item has invalid quantity"),
            { cartItemId: item.id, quantity: item.quantity },
          ),
          "Cart item validation failed: invalid quantity",
        );
        throw new BadRequestException(
          `Cart item ${item.id} has invalid quantity: ${item.quantity}`,
        );
      }

      if (!item.price || item.price < 0) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "validateCartItems",
            new Error("Cart item has invalid price"),
            { cartItemId: item.id, price: item.price },
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
   * Validate cart and fetch cart items
   * Combines cart validation and item fetching with validation
   * @returns Validated cart items
   * @throws BadRequestException if validation fails
   */
  @Trace({ operation: "OrderCartValidationService.validateAndFetchCartItems" })
  async validateAndFetchCartItems(cartId: string): Promise<
    Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }>
  > {
    // Get cart and validate it's not empty
    const cart = await this.cartsService.getCartById(cartId);
    this.validateCartNotEmpty(cart as { id: string; items?: Array<{ id: string }> | null } | null);

    // Get cart items with metadata
    const cartItemIds = cart.items?.map((item) => item.id);
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

    // Validate cart items
    this.validateCartItems(cartItemIds, allCartItems);

    this.logger.debug(
      createLogContext(this.contextService, "validateAndFetchCartItems", {
        cartId,
        itemsCount: allCartItems.length,
      }),
      "Cart validation successful",
    );

    return allCartItems;
  }

  /**
   * Validate bundle cart item metadata
   * @throws BadRequestException if bundle metadata is invalid
   */
  @Trace({ operation: "OrderCartValidationService.validateBundleMetadata" })
  validateBundleMetadata(
    itemId: string,
    metadata: unknown,
  ): BundleCartItemMetadata {
    const itemMetadata = metadata as BundleCartItemMetadata | null;
    if (!itemMetadata || itemMetadata.type !== "bundle") {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateBundleMetadata",
          new Error("Invalid bundle metadata"),
          { itemId, metadata },
        ),
        "Bundle metadata validation failed",
      );
      throw new BadRequestException(
        `Cart item ${itemId} has invalid bundle metadata`,
      );
    }
    return itemMetadata;
  }

  /**
   * Validate cart item quantities are positive
   * @throws BadRequestException if any quantity is invalid
   */
  @Trace({ operation: "OrderCartValidationService.validateQuantities" })
  validateQuantities(items: Array<{ id: string; quantity: number }>): void {
    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "validateQuantities",
            new Error("Invalid quantity"),
            { itemId: item.id, quantity: item.quantity },
          ),
          "Quantity validation failed",
        );
        throw new BadRequestException(
          `Item ${item.id} has invalid quantity: ${item.quantity}`,
        );
      }
    }
  }
}
