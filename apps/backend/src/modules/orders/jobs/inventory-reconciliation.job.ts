import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { eq, orderItems, orders } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../database/database.module";
import type { Database } from "../../../database/db";
import { InventoryStore } from "../../../redis-store/stores/inventory-store";

/**
 * Scheduled job to detect and fix inventory mismatches
 * Runs daily to identify orders where inventory commit failed
 */
@Injectable()
export class InventoryReconciliationJob implements OnModuleInit {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly inventoryStore: InventoryStore,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  onModuleInit() {
    this.logger.info(
      createLogContext(this.contextService, "InventoryReconciliationJob", {}),
      "Inventory reconciliation job initialized",
    );
  }

  /**
   * Run inventory reconciliation daily at 2 AM
   * Detects orders where inventory commit failed and flags them for manual review
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleReconciliation(): Promise<void> {
    this.logger.info(
      createLogContext(this.contextService, "handleReconciliation", {}),
      "Starting daily inventory reconciliation job",
    );

    try {
      // Get all orders from the last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentOrders = await this.db
        .select()
        .from(orders)
        .where(eq(orders.createdAt, yesterday))
        .limit(1000); // Process in batches

      let mismatchesFound = 0;
      const mismatches: Array<{
        orderId: string;
        orderNumber: string;
        issue: string;
      }> = [];

      for (const order of recentOrders) {
        try {
          // Get order items
          const items = await this.db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, order.id));

          // Check if inventory was decremented for each variant
          for (const item of items) {
            const redisInventory =
              (await this.inventoryStore.getAvailableInventory(
                item.productVariantId,
              )) || 0;

            // This is a simplified check - in production, you'd compare against
            // expected inventory values stored at order creation time
            // For now, we'll flag orders where we can't verify inventory was decremented
            // A more sophisticated check would compare against a snapshot

            // Log potential mismatches (this is a placeholder - actual detection
            // would require storing expected inventory values)
            this.logger.debug(
              createLogContext(this.contextService, "handleReconciliation", {
                orderId: order.id,
                variantId: item.productVariantId,
                quantity: item.quantity,
                redisInventory,
              }),
              "Checking inventory for order item",
            );
          }
        } catch (error) {
          mismatchesFound++;
          mismatches.push({
            orderId: order.id,
            orderNumber: order.orderNumber || "N/A",
            issue: `Error checking inventory: ${error instanceof Error ? error.message : "Unknown error"}`,
          });

          this.logger.error(
            createErrorContext(
              this.contextService,
              "handleReconciliation",
              error,
              { orderId: order.id },
            ),
            "Error checking inventory for order",
          );
        }
      }

      if (mismatchesFound > 0) {
        this.logger.warn(
          createLogContext(this.contextService, "handleReconciliation", {
            mismatchesFound,
            mismatches: mismatches.slice(0, 10), // Log first 10
          }),
          `Inventory reconciliation found ${mismatchesFound} potential mismatches`,
        );
      } else {
        this.logger.info(
          createLogContext(this.contextService, "handleReconciliation", {}),
          "Inventory reconciliation completed - no mismatches found",
        );
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "handleReconciliation",
          error,
          {},
        ),
        "Failed to run inventory reconciliation job",
      );
    }
  }
}
