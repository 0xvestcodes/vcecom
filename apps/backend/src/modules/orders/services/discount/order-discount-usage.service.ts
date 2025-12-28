import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { DiscountsService } from "../../../discounts/discounts.service";

/**
 * Service responsible for recording discount usage
 */
@Injectable()
export class OrderDiscountUsageService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly discountsService: DiscountsService,
  ) {}

  /**
   * Record discount usage for an order
   */
  @Trace({ operation: "OrderDiscountUsageService.recordDiscountUsage" })
  async recordDiscountUsage(
    orderId: string,
    discountCode: string | null,
    discountAmount: number,
    userId: string | null | undefined,
  ): Promise<void> {
    if (!discountCode || discountAmount <= 0) {
      return; // No discount to record
    }

    try {
      const discount = await this.discountsService.findByCode(discountCode);
      await this.discountsService.recordUsage(
        discount.id,
        orderId,
        userId || undefined,
      );

      this.logger.debug(
        createLogContext(this.contextService, "recordDiscountUsage", {
          orderId,
          discountCode,
          discountId: discount.id,
        }),
        "Discount usage recorded",
      );
    } catch (error) {
      // Log but don't throw - discount usage recording failure shouldn't break order creation
      this.logger.error(
        createErrorContext(this.contextService, "recordDiscountUsage", error, {
          orderId,
          discountCode,
          userId,
        }),
        "Failed to record discount usage",
      );
    }
  }
}
