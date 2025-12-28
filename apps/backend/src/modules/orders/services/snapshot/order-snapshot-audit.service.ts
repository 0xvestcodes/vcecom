import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { DiscountSnapshot } from "../../../discounts/engine/discount-engine.types";
import { PricingSnapshot } from "../../../pricing/engine/pricing-engine.types";
import { PricingAuditService } from "../../../pricing/services/pricing-audit.service";
import { OrderDiscountService } from "../discount/order-discount.service";

/**
 * Service responsible for snapshot audit logging
 * Handles pricing and discount snapshot usage tracking
 */
@Injectable()
export class OrderSnapshotAuditService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly pricingAuditService: PricingAuditService,
    private readonly discountService: OrderDiscountService,
  ) {}

  /**
   * Log pricing snapshot usage
   */
  @Trace({ operation: "OrderSnapshotAuditService.logPricingSnapshotUsage" })
  async logPricingSnapshotUsage(
    checkoutSessionId: string,
    orderId: string,
    pricingSnapshot: PricingSnapshot | null,
  ): Promise<void> {
    if (!pricingSnapshot) {
      return;
    }

    try {
      await this.pricingAuditService.logSnapshotUsed(
        checkoutSessionId,
        orderId,
        pricingSnapshot,
      );
      this.logger.debug(
        createLogContext(this.contextService, "logPricingSnapshotUsage", {
          checkoutSessionId,
          orderId,
        }),
        "Pricing snapshot usage logged",
      );
    } catch (error) {
      // Log but don't throw - audit logging failure shouldn't break order creation
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "logPricingSnapshotUsage",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to log pricing snapshot usage",
      );
    }
  }

  /**
   * Log discount snapshot usage
   */
  @Trace({ operation: "OrderSnapshotAuditService.logDiscountSnapshotUsage" })
  async logDiscountSnapshotUsage(
    checkoutSessionId: string,
    orderId: string,
    discountSnapshot: DiscountSnapshot | null,
  ): Promise<void> {
    if (!discountSnapshot) {
      return;
    }

    try {
      await this.discountService.logDiscountSnapshotUsage(
        checkoutSessionId,
        orderId,
        discountSnapshot,
      );
      this.logger.debug(
        createLogContext(this.contextService, "logDiscountSnapshotUsage", {
          checkoutSessionId,
          orderId,
        }),
        "Discount snapshot usage logged",
      );
    } catch (error) {
      // Log but don't throw - audit logging failure shouldn't break order creation
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "logDiscountSnapshotUsage",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to log discount snapshot usage",
      );
    }
  }

  /**
   * Log both pricing and discount snapshot usage
   */
  @Trace({ operation: "OrderSnapshotAuditService.logSnapshotUsage" })
  async logSnapshotUsage(
    checkoutSessionId: string,
    orderId: string,
    pricingSnapshot: PricingSnapshot | null,
    discountSnapshot: DiscountSnapshot | null,
  ): Promise<void> {
    await Promise.all([
      this.logPricingSnapshotUsage(checkoutSessionId, orderId, pricingSnapshot),
      this.logDiscountSnapshotUsage(
        checkoutSessionId,
        orderId,
        discountSnapshot,
      ),
    ]);
  }
}
