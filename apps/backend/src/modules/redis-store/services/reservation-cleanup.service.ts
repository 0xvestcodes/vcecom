import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Cron, Interval } from "@nestjs/schedule";
import { and, cartItems, eq } from "@vcecom/db";
import Redis from "ioredis";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { CLEANUP_INTERVAL_MS } from "../../../common/constants/timeout.constants";
import { DB_TOKEN } from "../../../modules/database/database.constants";
import type { Database } from "../../../modules/database/db";
import { KEY_PATTERNS } from "../constants/key-patterns";
import { RedisStoreService } from "../redis-store.service";
import { CheckoutLockStore } from "../stores/checkout-lock-store";
import { HeartbeatStore } from "../stores/heartbeat-store";
import { InventoryStore } from "../stores/inventory-store";
import { StaleMarkerStore } from "../stores/stale-marker-store";

/**
 * Reservation cleanup service
 * Handles cleanup of stale reservations and inactive carts
 * Uses two-phase approach to prevent race conditions
 */
@Injectable()
export class ReservationCleanupService implements OnModuleInit {
  private client!: Redis;

  constructor(
    private readonly redisStoreService: RedisStoreService,
    private readonly inventoryStore: InventoryStore,
    private readonly heartbeatStore: HeartbeatStore,
    private readonly checkoutLockStore: CheckoutLockStore,
    private readonly staleMarkerStore: StaleMarkerStore,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  async onModuleInit() {
    try {
      this.client = await this.redisStoreService.getClient();
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "cleanupInit", error),
        "Reservation cleanup service not initialized - will retry when Redis is available",
      );
    }
  }

  /**
   * Job 1: Stale Reservation Cleanup
   * Detects cart items with expired reservations and marks them as STALE
   * Runs every 2 minutes
   */
  @Cron("*/2 * * * *") // Every 2 minutes
  async cleanupStaleReservations(): Promise<void> {
    try {
      this.logger.debug(
        createLogContext(this.contextService, "cleanupStaleReservations", {}),
        "Starting stale reservation cleanup",
      );

      // Find cart items with state='fresh' that don't have active reservations
      // This detects items whose reservations have expired (Redis auto-removed them)
      const freshCartItems = await this.db
        .select({
          id: cartItems.id,
          cartId: cartItems.cartId,
          productVariantId: cartItems.productVariantId,
        })
        .from(cartItems)
        .where(eq(cartItems.state, "fresh"))
        .limit(1000); // Process in batches

      let markedStale = 0;
      let errors = 0;

      for (const item of freshCartItems) {
        try {
          // Check if reservation exists in Redis
          const reservationKey = KEY_PATTERNS.INVENTORY_RESERVATION(
            item.cartId,
            item.productVariantId,
          );
          const reservationExists = await this.client.exists(reservationKey);

          if (!reservationExists) {
            // Reservation expired - mark item as STALE
            await this.markCartItemStale(item.cartId, item.productVariantId);
            markedStale++;
          }
        } catch (error) {
          errors++;
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "cleanupStaleReservation",
              error,
              { cartId: item.cartId, variantId: item.productVariantId },
            ),
            `Failed to check/cleanup stale reservation for cart item ${item.id}`,
          );
        }
      }

      this.logger.info(
        createLogContext(this.contextService, "cleanupStaleReservations", {
          markedStale,
          errors,
          totalScanned: freshCartItems.length,
        }),
        `Stale reservation cleanup completed: ${markedStale} items marked stale, ${errors} errors`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "cleanupStaleReservations",
          error,
        ),
        "Failed to cleanup stale reservations",
      );
    }
  }

  /**
   * Job 2: Inactive Cart Cleanup - Phase 1 (Mark Stale)
   * Marks carts as stale if heartbeat is missing for > 2 minutes
   * NON-BLOCKING - returns immediately after scheduling
   * Runs every 5 minutes
   */
  @Cron("*/5 * * * *") // Every 5 minutes
  async cleanupInactiveCartsPhase1(): Promise<void> {
    try {
      this.logger.debug(
        createLogContext(this.contextService, "cleanupInactiveCartsPhase1", {}),
        "Starting inactive cart cleanup phase 1 (mark stale)",
      );

      // Scan for all heartbeat keys
      const heartbeatKeys: string[] = [];
      let cursor = "0";

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          "MATCH",
          "heartbeat:*",
          "COUNT",
          100,
        );
        cursor = nextCursor;
        heartbeatKeys.push(...keys);
      } while (cursor !== "0");

      let markedStale = 0;

      // Check each heartbeat
      for (const heartbeatKey of heartbeatKeys) {
        try {
          // Extract cartId from key: heartbeat:{cartId}
          const cartId = heartbeatKey.replace("heartbeat:", "");

          // Check TTL - if expired or missing, mark as stale
          const ttl = await this.client.ttl(heartbeatKey);
          if (ttl <= 0) {
            // Heartbeat expired or missing - mark as stale
            await this.heartbeatStore.markCartStale(cartId);
            markedStale++;

            // Schedule phase 2 by storing cartId in Redis with delay marker
            // Phase 2 will check this marker after 30 seconds
            const phase2MarkerKey = `cleanup:phase2:${cartId}`;
            await this.client.setex(phase2MarkerKey, 60, "1"); // 60s TTL (30s delay + 30s buffer)
          }
        } catch (error) {
          this.logger.warn(
            createErrorContext(this.contextService, "markCartStale", error, {
              heartbeatKey,
            }),
            `Failed to mark cart as stale: ${heartbeatKey}`,
          );
        }
      }

      this.logger.info(
        createLogContext(this.contextService, "cleanupInactiveCartsPhase1", {
          markedStale,
          totalScanned: heartbeatKeys.length,
        }),
        `Phase 1 completed: ${markedStale} carts marked stale`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "cleanupInactiveCartsPhase1",
          error,
        ),
        "Failed to cleanup inactive carts phase 1",
      );
    }
  }

  /**
   * Job 3: Inactive Cart Cleanup - Phase 2 (Release Reservations)
   * Processes carts marked stale in phase 1
   * Checks checkout lock and heartbeat before releasing
   * Runs every 30 seconds (checks phase2 markers)
   */
  @Interval(CLEANUP_INTERVAL_MS) // Every 30 seconds
  async cleanupInactiveCartsPhase2(): Promise<void> {
    try {
      // Scan for phase 2 markers
      const phase2Markers: string[] = [];
      let cursor = "0";

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          "MATCH",
          "cleanup:phase2:*",
          "COUNT",
          100,
        );
        cursor = nextCursor;
        phase2Markers.push(...keys);
      } while (cursor !== "0");

      let released = 0;
      let skipped = 0;
      let errors = 0;

      for (const markerKey of phase2Markers) {
        try {
          // Extract cartId from key: cleanup:phase2:{cartId}
          const cartId = markerKey.replace("cleanup:phase2:", "");

          // Check if checkout lock exists - if yes, abort
          const hasCheckoutLock =
            await this.checkoutLockStore.hasCheckoutLock(cartId);
          if (hasCheckoutLock) {
            skipped++;
            // Delete marker - will be recreated in next phase 1 if still inactive
            await this.client.del(markerKey);
            continue;
          }

          // Check if heartbeat is active - if yes, abort
          const isActive = await this.heartbeatStore.isCartActive(cartId);
          if (isActive) {
            skipped++;
            // Delete marker and stale marker - cart became active
            await this.client.del(markerKey);
            await this.client.del(`cart:stale:${cartId}`);
            continue;
          }

          // Check if cart is still marked stale
          const isStale = await this.client.exists(`cart:stale:${cartId}`);
          if (!isStale) {
            skipped++;
            // Delete marker - cart is no longer stale
            await this.client.del(markerKey);
            continue;
          }

          // Release all reservations for this cart (critical - frees inventory)
          await this.inventoryStore.releaseCartReservations(cartId);

          // Note: Cart items clearing is handled by CartCleanupService separately
          // Reservations are the critical part - they're now released

          // Delete stale marker and phase 2 marker
          await this.client.del(`cart:stale:${cartId}`);
          await this.client.del(markerKey);

          released++;
        } catch (error) {
          errors++;
          this.logger.warn(
            createErrorContext(
              this.contextService,
              "cleanupInactiveCartPhase2",
              error,
              { markerKey },
            ),
            `Failed to cleanup inactive cart: ${markerKey}`,
          );
        }
      }

      if (released > 0 || skipped > 0 || errors > 0) {
        this.logger.info(
          createLogContext(this.contextService, "cleanupInactiveCartsPhase2", {
            released,
            skipped,
            errors,
            totalScanned: phase2Markers.length,
          }),
          `Phase 2 completed: ${released} released, ${skipped} skipped, ${errors} errors`,
        );
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "cleanupInactiveCartsPhase2",
          error,
        ),
        "Failed to cleanup inactive carts phase 2",
      );
    }
  }

  /**
   * Mark cart item as stale when reservation expires
   * Updates database state and sets Redis stale marker
   */
  private async markCartItemStale(
    cartId: string,
    variantId: string,
  ): Promise<void> {
    try {
      // Mark in Redis
      await this.staleMarkerStore.markItemStale(cartId, variantId);

      // Update database state
      await this.db
        .update(cartItems)
        .set({
          state: "stale",
          staleMarkedAt: new Date(),
        })
        .where(
          and(
            eq(cartItems.cartId, cartId),
            eq(cartItems.productVariantId, variantId),
          ),
        );

      this.logger.debug(
        createLogContext(this.contextService, "markCartItemStale", {
          cartId,
          variantId,
        }),
        `Marked cart item as stale: cart ${cartId}, variant ${variantId}`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "markCartItemStale", error, {
          cartId,
          variantId,
        }),
        `Failed to mark cart item as stale: cart ${cartId}, variant ${variantId}`,
      );
      // Don't throw - marking stale is best-effort
    }
  }
}
