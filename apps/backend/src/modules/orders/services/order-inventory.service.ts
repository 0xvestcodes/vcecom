import { Inject, Injectable } from "@nestjs/common";
import { cartItems, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ReservationMode } from "../../../common/constants/inventory.constants";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { BundleCartItemMetadata } from "../../carts/dto/bundle-cart-item.dto";
import { BundlePricingService } from "../../pricing/services/bundle-pricing.service";
import { CheckoutLockStore } from "../../redis-store/stores/checkout-lock-store";
import { InventoryStore } from "../../redis-store/stores/inventory-store";

/**
 * Service responsible for order inventory operations
 * Handles atomic inventory commitment and synchronization
 */
@Injectable()
export class OrderInventoryService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly inventoryStore: InventoryStore,
    private readonly checkoutLockStore: CheckoutLockStore,
    private readonly bundlePricingService: BundlePricingService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Commit inventory reservations for variant items
   * Uses atomic Lua script to ensure consistency
   * @param cartId - Cart ID
   * @param orderId - Order ID (for logging)
   * @param variantItems - Array of variant items to commit
   */
  async commitVariantItemsInventory(
    cartId: string,
    orderId: string,
    variantItems: Array<{
      productVariantId: string;
      quantity: number;
    }>,
  ): Promise<void> {
    for (const item of variantItems) {
      // Determine reservation mode by checking if soft reservation counter exists
      // If soft_reserved counter > 0, it was soft reserved, otherwise hard
      const softReserved = await this.inventoryStore.getReservedInventory(
        item.productVariantId,
      );
      const available =
        (await this.inventoryStore.getAvailableInventory(
          item.productVariantId,
        )) || 0;
      // Simple heuristic: if available <= 10, likely soft mode, otherwise hard
      // More accurate would be to store mode in reservation, but this works for now
      const mode = available <= 10 && softReserved > 0 ? "soft" : "hard";

      await this.inventoryStore.commitReservationAtomic(
        cartId,
        item.productVariantId,
        item.quantity,
        mode as ReservationMode,
      );

      // Sync Redis inventory value to database
      await this.syncInventoryToDatabase(item.productVariantId, orderId);
    }
  }

  /**
   * Commit inventory reservations for bundle items
   * Flattens bundle selections and commits each variant
   * @param cartId - Cart ID
   * @param orderId - Order ID (for logging)
   * @param bundleItems - Array of bundle items to commit
   */
  async commitBundleItemsInventory(
    cartId: string,
    orderId: string,
    bundleItems: Array<{
      id: string;
      quantity: number;
      metadata: unknown;
    }>,
  ): Promise<void> {
    for (const bundleItem of bundleItems) {
      const bundleMetadata = bundleItem.metadata as BundleCartItemMetadata;
      const variantQuantities =
        this.bundlePricingService.flattenBundleSelections(
          bundleMetadata.selections,
          bundleItem.quantity,
        );

      for (const vq of variantQuantities) {
        // Determine reservation mode
        const softReserved = await this.inventoryStore.getReservedInventory(
          vq.variantId,
        );
        const available =
          (await this.inventoryStore.getAvailableInventory(vq.variantId)) || 0;
        const mode = available <= 10 && softReserved > 0 ? "soft" : "hard";

        await this.inventoryStore.commitReservationAtomic(
          cartId,
          vq.variantId,
          vq.quantity,
          mode as ReservationMode,
        );

        // Sync Redis inventory value to database
        await this.syncInventoryToDatabase(vq.variantId, orderId);
      }
    }
  }

  /**
   * Commit inventory for an order (both variant and bundle items)
   * CRITICAL: Uses atomic Lua script to ensure consistency
   * If this fails, inventory will be out of sync and needs manual reconciliation
   * @param cartId - Cart ID
   * @param orderId - Order ID
   * @param variantItems - Variant items to commit
   * @param bundleItems - Bundle items to commit
   * @param clearCheckoutLock - Whether to clear checkout lock after commit
   */
  async commitOrderInventory(
    cartId: string,
    orderId: string,
    variantItems: Array<{
      productVariantId: string;
      quantity: number;
    }>,
    bundleItems: Array<{
      id: string;
      quantity: number;
      metadata: unknown;
    }>,
    clearCheckoutLock = false,
  ): Promise<void> {
    try {
      // Commit reservations for variant items using atomic commit
      await this.commitVariantItemsInventory(cartId, orderId, variantItems);

      // Commit reservations for bundle items (all variants) using atomic commit
      await this.commitBundleItemsInventory(cartId, orderId, bundleItems);

      this.logger.info(
        createLogContext(this.contextService, "commitInventory", {
          orderId,
          variantItemsCount: variantItems.length,
          bundleItemsCount: bundleItems.length,
        }),
        "Inventory successfully committed atomically for order",
      );

      // Mark all cart items as COMMITTED after successful inventory commit
      await this.markCartItemsCommitted(cartId, orderId);

      // Clear checkout lock after successful commit (if requested)
      if (clearCheckoutLock) {
        await this.clearCheckoutLock(cartId, orderId);
      }
    } catch (error) {
      // CRITICAL ERROR: Inventory commit failed
      // Order is already created, but inventory wasn't decremented
      // Log as critical error for manual reconciliation
      this.logger.error(
        createErrorContext(this.contextService, "commitInventory", error, {
          orderId,
          cartId,
          variantItemsCount: variantItems.length,
          bundleItemsCount: bundleItems.length,
          critical: true,
        }),
        "CRITICAL: Failed to commit inventory for order - manual reconciliation required",
      );
      // Don't throw - order is already created, inventory reconciliation will need to be done manually
    }
  }

  /**
   * Sync inventory from Redis to database
   * Non-critical operation - Redis is source of truth
   * @param variantId - Product variant ID
   * @param orderId - Order ID (for logging)
   */
  private async syncInventoryToDatabase(
    variantId: string,
    orderId: string,
  ): Promise<void> {
    try {
      await this.inventoryStore.syncInventoryToDatabase(variantId);
    } catch (error) {
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "syncInventoryToDatabase",
          error,
          { orderId, variantId },
        ),
        "Failed to sync inventory to database (non-critical, Redis is source of truth)",
      );
    }
  }

  /**
   * Mark all cart items as COMMITTED after successful inventory commit
   * @param cartId - Cart ID
   * @param orderId - Order ID (for logging)
   */
  private async markCartItemsCommitted(
    cartId: string,
    orderId: string,
  ): Promise<void> {
    try {
      await this.db
        .update(cartItems)
        .set({ state: "committed" })
        .where(eq(cartItems.cartId, cartId));

      this.logger.debug(
        createLogContext(this.contextService, "markCartItemsCommitted", {
          cartId,
          orderId,
        }),
        "Marked all cart items as COMMITTED",
      );
    } catch (error) {
      // Log but don't fail - state update failure is non-critical
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "markCartItemsCommitted",
          error,
          { cartId, orderId },
        ),
        "Failed to mark cart items as COMMITTED",
      );
    }
  }

  /**
   * Clear checkout lock after successful order creation
   * @param cartId - Cart ID
   * @param orderId - Order ID (for logging)
   */
  private async clearCheckoutLock(
    cartId: string,
    orderId: string,
  ): Promise<void> {
    try {
      await this.checkoutLockStore.clearCheckoutLock(cartId);
    } catch (error) {
      // Log but don't fail - lock clear failure is non-critical
      this.logger.warn(
        createErrorContext(this.contextService, "clearCheckoutLock", error, {
          cartId,
          orderId,
        }),
        "Failed to clear checkout lock after order finalization",
      );
    }
  }
}
