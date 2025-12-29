import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { CartsService } from "../../../carts/carts.service";

/**
 * Service responsible for cart cleanup after order creation
 */
@Injectable()
export class OrderCartCleanupService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly cartsService: CartsService,
  ) {}

  /**
   * Clear cart after order creation
   */
  @Trace({ operation: "OrderCartCleanupService.clearCart" })
  async clearCartAfterOrder(
    cartId: string,
    userId: string | null | undefined,
  ): Promise<void> {
    try {
      const cart = await this.cartsService.getCartById(cartId);
      if (cart) {
        await this.cartsService.clearCart(userId || null, cart.sessionId);
        this.logger.debug(
          createLogContext(this.contextService, "clearCartAfterOrder", {
            cartId,
            userId,
          }),
          "Cart cleared after order creation",
        );
      }
    } catch (error) {
      // Log but don't throw - cart clearing failure shouldn't break order creation
      this.logger.warn(
        createErrorContext(this.contextService, "clearCartAfterOrder", error, {
          cartId,
          userId,
        }),
        "Failed to clear cart after order creation",
      );
    }
  }

  /**
   * Clear cart by cart ID (for COD orders)
   */
  @Trace({ operation: "OrderCartCleanupService.clearCartById" })
  async clearCartById(cartId: string): Promise<void> {
    try {
      await this.cartsService.clearCartById(cartId);
      this.logger.debug(
        createLogContext(this.contextService, "clearCartById", {
          cartId,
        }),
        "Cart cleared by ID",
      );
    } catch (error) {
      // Log but don't throw - cart clearing failure shouldn't break order creation
      this.logger.warn(
        createErrorContext(this.contextService, "clearCartById", error, {
          cartId,
        }),
        "Failed to clear cart by ID",
      );
    }
  }
}
