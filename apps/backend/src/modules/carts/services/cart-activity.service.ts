import { Inject, Injectable } from "@nestjs/common";
import { cartActivities, cartActivityTypeEnum, desc, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";

export type CartActivityType = (typeof cartActivityTypeEnum.enumValues)[number];

export interface TrackActivityParams {
  cartId: string;
  customerId?: string | null;
  sessionId?: string | null;
  activityType: CartActivityType;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CartActivityService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Track cart activity
   * Non-blocking - logs errors but doesn't throw
   */
  async trackActivity(params: TrackActivityParams): Promise<void> {
    const { cartId, customerId, sessionId, activityType, metadata } = params;

    try {
      // Get IP and user agent from context
      const context = this.contextService.get();
      const ipAddress = context?.ip || null;
      const userAgent = context?.userAgent || null;

      await this.db.insert(cartActivities).values({
        cartId,
        customerId: customerId || null,
        sessionId: sessionId || null,
        activityType,
        metadata: metadata || null,
        ipAddress,
        userAgent,
      });

      this.logger.debug(
        createLogContext(this.contextService, "trackActivity", {
          cartId,
          activityType,
        }),
        `Cart activity tracked: ${activityType}`,
      );
    } catch (error) {
      // Don't throw - activity tracking shouldn't break cart operations
      this.logger.error(
        createErrorContext(this.contextService, "trackActivity", error, {
          cartId,
          activityType,
        }),
        "Failed to track cart activity",
      );
    }
  }

  /**
   * Get activity history for a cart
   */
  async getCartActivity(
    cartId: string,
    limit = 50,
  ): Promise<(typeof cartActivities.$inferSelect)[]> {
    try {
      const activities = await this.db
        .select()
        .from(cartActivities)
        .where(eq(cartActivities.cartId, cartId))
        .orderBy(desc(cartActivities.createdAt))
        .limit(limit);

      return activities;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getCartActivity", error, {
          cartId,
        }),
        "Failed to get cart activity",
      );
      return [];
    }
  }

  /**
   * Get all cart activity for a customer
   */
  async getCustomerCartActivity(
    customerId: string,
    limit = 100,
  ): Promise<(typeof cartActivities.$inferSelect)[]> {
    try {
      const activities = await this.db
        .select()
        .from(cartActivities)
        .where(eq(cartActivities.customerId, customerId))
        .orderBy(desc(cartActivities.createdAt))
        .limit(limit);

      return activities;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "getCustomerCartActivity",
          error,
          { customerId },
        ),
        "Failed to get customer cart activity",
      );
      return [];
    }
  }

  /**
   * Get last activity timestamp for a cart
   */
  async getLastActivityAt(cartId: string): Promise<Date | null> {
    try {
      const [activity] = await this.db
        .select({ createdAt: cartActivities.createdAt })
        .from(cartActivities)
        .where(eq(cartActivities.cartId, cartId))
        .orderBy(desc(cartActivities.createdAt))
        .limit(1);

      return activity?.createdAt || null;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getLastActivityAt", error, {
          cartId,
        }),
        "Failed to get last activity timestamp",
      );
      return null;
    }
  }
}
