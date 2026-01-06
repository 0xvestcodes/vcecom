import { forwardRef, Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, cartItems, carts, eq, gt, lt, sql } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { CheckoutState } from "../../../modules/redis-store/constants/checkout-states";
import { RedisStoreService } from "../../redis-store/redis-store.service";
import { CheckoutStore } from "../../redis-store/stores/checkout-store";
import {
  ABANDONED_CART_DETECTION_HOURS,
  ABANDONED_CART_MIN_VALUE,
} from "../carts.constants";
import { AbandonedCartRecoveryService } from "./abandoned-cart-recovery.service";
import { CartActivityService } from "./cart-activity.service";

/**
 * Abandoned Cart Detection Service
 * Detects abandoned carts and queues them for recovery
 */
@Injectable()
export class AbandonedCartDetectionService implements OnModuleInit {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly checkoutStore: CheckoutStore,
    private readonly redisStoreService: RedisStoreService,
    private readonly cartActivityService: CartActivityService,
    @Inject(forwardRef(() => AbandonedCartRecoveryService))
    private readonly recoveryService: AbandonedCartRecoveryService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    this.logger.info(
      createLogContext(this.contextService, "onModuleInit", {}),
      "Abandoned cart detection service initialized",
    );
  }

  /**
   * Detect abandoned carts
   * Runs every 30 minutes to detect carts that should be marked as abandoned
   */
  @Cron("*/30 * * * *") // Every 30 minutes
  async detectAbandonedCarts() {
    this.logger.debug(
      createLogContext(this.contextService, "detectAbandonedCarts", {}),
      "Starting abandoned cart detection",
    );

    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(
        cutoffDate.getHours() - ABANDONED_CART_DETECTION_HOURS,
      );

      // Find carts with items that haven't been updated recently
      const candidateCarts = await this.db
        .select({
          id: carts.id,
          customerId: carts.customerId,
          sessionId: carts.sessionId,
          total: carts.total,
          updatedAt: carts.updatedAt,
        })
        .from(carts)
        .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
        .where(
          and(
            lt(carts.updatedAt, cutoffDate),
            gt(carts.total, ABANDONED_CART_MIN_VALUE),
          ),
        )
        .groupBy(carts.id)
        .having(sql`COUNT(${cartItems.id}) > 0`);

      let detectedCount = 0;
      let queuedCount = 0;

      for (const cart of candidateCarts) {
        try {
          const shouldMark = await this.shouldMarkAsAbandoned(cart.id);
          if (shouldMark) {
            detectedCount++;
            await this.queueForRecovery(
              cart.id,
              cart.customerId,
              cart.sessionId,
            );
            queuedCount++;
          }
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "detectAbandonedCarts.processCart",
              error,
              { cartId: cart.id },
            ),
            "Failed to process cart for abandonment detection",
          );
          // Continue with other carts
        }
      }

      this.logger.info(
        createLogContext(this.contextService, "detectAbandonedCarts", {
          detectedCount,
          queuedCount,
          totalCandidates: candidateCarts.length,
        }),
        "Abandoned cart detection completed",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "detectAbandonedCarts", error),
        "Failed to run abandoned cart detection",
      );
    }
  }

  /**
   * Determine if a cart should be marked as abandoned
   */
  async shouldMarkAsAbandoned(cartId: string): Promise<boolean> {
    try {
      // Check if cart already has a recovery record
      const { abandonedCartRecoveries } = await import("@vcecom/db");
      const [existingRecovery] = await this.db
        .select()
        .from(abandonedCartRecoveries)
        .where(eq(abandonedCartRecoveries.cartId, cartId))
        .limit(1);

      if (existingRecovery) {
        // Already queued for recovery
        return false;
      }

      // Check checkout session state
      // Scan Redis for checkout sessions (similar to admin service)
      const redisClient = await this.redisStoreService.getClient();
      const sessionKeys: string[] = [];
      let cursor = "0";

      do {
        const result = await redisClient.scan(
          cursor,
          "MATCH",
          "checkout:session:*",
          "COUNT",
          100,
        );
        cursor = result[0];
        sessionKeys.push(...result[1]);
      } while (cursor !== "0");

      // Check if cart has an active checkout session
      let hasActiveCheckout = false;
      for (const key of sessionKeys) {
        try {
          const session = await this.checkoutStore.getSession(
            key.replace("checkout:session:", ""),
          );
          if (
            session &&
            session.cartId === cartId &&
            (session.state === CheckoutState.CREATED ||
              session.state === CheckoutState.LOCKED) &&
            !session.orderId
          ) {
            hasActiveCheckout = true;
            break;
          }
        } catch (_error) {
          // Continue checking other sessions
        }
      }

      // Cart is abandoned if:
      // 1. Has no active checkout session OR checkout session is in CREATED/LOCKED state without order
      // 2. Has items
      // 3. Hasn't been updated recently (checked in query)
      // 4. Meets minimum value threshold (checked in query)

      // Check last activity
      const lastActivityAt =
        await this.cartActivityService.getLastActivityAt(cartId);
      const cutoffDate = new Date();
      cutoffDate.setHours(
        cutoffDate.getHours() - ABANDONED_CART_DETECTION_HOURS,
      );

      const hasRecentActivity = lastActivityAt && lastActivityAt > cutoffDate;

      // Mark as abandoned if no recent activity and either no checkout session or abandoned checkout session
      return !hasRecentActivity && !hasActiveCheckout;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "shouldMarkAsAbandoned",
          error,
          { cartId },
        ),
        "Failed to check if cart should be marked as abandoned",
      );
      return false;
    }
  }

  /**
   * Queue cart for recovery workflow
   */
  async queueForRecovery(
    cartId: string,
    customerId: string | null,
    sessionId: string | null,
  ): Promise<void> {
    try {
      // Use recovery service to create recovery record and queue job
      await this.recoveryService.createRecoveryRecord(
        cartId,
        customerId,
        sessionId,
      );

      this.logger.info(
        createLogContext(this.contextService, "queueForRecovery", {
          cartId,
        }),
        "Cart queued for recovery",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "queueForRecovery", error, {
          cartId,
        }),
        "Failed to queue cart for recovery",
      );
      throw error;
    }
  }
}
