import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  and,
  cartItems,
  carts,
  eq,
  inArray,
  isNull,
  lt,
  sql,
} from "@vcecom/db";
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
  private readonly COMMITTED_ARCHIVE_DAYS = 30; // Archive committed items after 30 days

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

  /**
   * Archive committed cart items after 30 days
   * Runs daily at 2 AM to archive cart items that were committed more than 30 days ago
   * Committed items are tied to orders, so archiving them helps keep the cart_items table clean
   */
  @Cron("0 2 * * *") // Daily at 2 AM
  async archiveCommittedCartItems() {
    this.logger.debug(
      createLogContext(this.contextService, "archiveCommittedCartItems", {}),
      "Starting committed cart items archive",
    );

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.COMMITTED_ARCHIVE_DAYS);

      // Find committed cart items that haven't been archived yet
      // Use updatedAt to determine when they were committed (state changes update this field)
      const itemsToArchive = await this.db
        .select({ id: cartItems.id })
        .from(cartItems)
        .where(
          and(
            eq(cartItems.state, "committed"),
            lt(cartItems.updatedAt, cutoffDate),
            isNull(cartItems.archivedAt),
          ),
        );

      let archivedCount = 0;

      // Archive items in batches to avoid overwhelming the database
      const batchSize = 100;
      for (let i = 0; i < itemsToArchive.length; i += batchSize) {
        const batch = itemsToArchive.slice(i, i + batchSize);
        const batchIds = batch.map((item) => item.id);

        try {
          await this.db
            .update(cartItems)
            .set({
              archivedAt: sql`NOW()`,
            })
            .where(
              and(
                inArray(cartItems.id, batchIds),
                isNull(cartItems.archivedAt), // Double-check to avoid race conditions
              ),
            );

          archivedCount += batch.length;
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "archiveCommittedCartItems",
              error,
              { batchSize: batch.length, batchIndex: i },
            ),
            "Failed to archive batch of committed cart items",
          );
          // Continue with next batch even if one fails
        }
      }

      this.logger.info(
        createLogContext(this.contextService, "archiveCommittedCartItems", {
          archivedCount,
          totalFound: itemsToArchive.length,
          cutoffDate: cutoffDate.toISOString(),
        }),
        "Committed cart items archive completed",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "archiveCommittedCartItems",
          error,
        ),
        "Failed to run committed cart items archive",
      );
      // Don't throw - cleanup failures shouldn't break the app
    }
  }
}
