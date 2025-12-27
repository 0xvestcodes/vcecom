import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { cartItems, carts, eq, lt } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { InventoryStore } from "../../redis-store/stores/inventory-store";

/**
 * Cart Cleanup Service
 * Cleans up abandoned carts and releases inventory reservations
 */
@Injectable()
export class CartCleanupService implements OnModuleInit {
  private readonly CART_EXPIRY_HOURS = 24; // Carts expire after 24 hours of inactivity

  constructor(
    private readonly inventoryStore: InventoryStore,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  async onModuleInit() {
    this.logger.info(
      createLogContext(this.contextService, "onModuleInit", {}),
      "Cart cleanup service initialized",
    );
  }

  /**
   * Cleanup abandoned carts
   * Runs every hour to clean up carts that haven't been updated in 24 hours
   */
  @Cron("0 * * * *") // Every hour
  async cleanupAbandonedCarts() {
    this.logger.debug(
      createLogContext(this.contextService, "cleanupAbandonedCarts", {}),
      "Starting abandoned cart cleanup",
    );

    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - this.CART_EXPIRY_HOURS);

      // Find abandoned carts (no updates in last 24 hours)
      const abandonedCarts = await this.db
        .select({ id: carts.id })
        .from(carts)
        .where(lt(carts.updatedAt, cutoffDate));

      let cleanedCount = 0;
      let reservationReleaseCount = 0;

      for (const cart of abandonedCarts) {
        try {
          // Release inventory reservations
          await this.inventoryStore.releaseCartReservations(cart.id);
          reservationReleaseCount++;

          // Delete cart items
          await this.db.delete(cartItems).where(eq(cartItems.cartId, cart.id));

          // Delete cart
          await this.db.delete(carts).where(eq(carts.id, cart.id));

          cleanedCount++;
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "cleanupAbandonedCarts",
              error,
              { cartId: cart.id },
            ),
            "Failed to clean up abandoned cart",
          );
          // Continue with other carts even if one fails
        }
      }

      this.logger.info(
        createLogContext(this.contextService, "cleanupAbandonedCarts", {
          cleanedCount,
          reservationReleaseCount,
          totalAbandoned: abandonedCarts.length,
        }),
        "Abandoned cart cleanup completed",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "cleanupAbandonedCarts", error),
        "Failed to run abandoned cart cleanup",
      );
      // Don't throw - cleanup failures shouldn't break the app
    }
  }

  /**
   * Cleanup expired reservations
   * Runs every 15 minutes to release reservations that have expired (TTL expired)
   * This is a safety net in case Redis TTL cleanup doesn't work properly
   */
  @Cron("*/15 * * * *") // Every 15 minutes
  async cleanupExpiredReservations() {
    this.logger.debug(
      createLogContext(this.contextService, "cleanupExpiredReservations", {}),
      "Starting expired reservation cleanup",
    );

    try {
      // The inventory reconciliation service already handles this
      // This is just an additional safety check
      const result = await this.inventoryStore.reconcileReservations();

      this.logger.debug(
        createLogContext(this.contextService, "cleanupExpiredReservations", {
          released: result.released,
          inconsistencies: result.inconsistencies,
          orphaned: result.orphaned,
        }),
        "Expired reservation cleanup completed",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "cleanupExpiredReservations",
          error,
        ),
        "Failed to run expired reservation cleanup",
      );
      // Don't throw - cleanup failures shouldn't break the app
    }
  }
}
