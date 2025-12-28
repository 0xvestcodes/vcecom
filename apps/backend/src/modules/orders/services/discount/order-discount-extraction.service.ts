import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { DiscountSnapshot } from "../../../discounts/engine/discount-engine.types";

/**
 * Service responsible for extracting discount information from snapshots
 */
@Injectable()
export class OrderDiscountExtractionService {
  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
  ) {}

  /**
   * Extract discount code from discount snapshot
   */
  @Trace({ operation: "OrderDiscountExtractionService.extractDiscountCode" })
  extractDiscountCode(
    discountSnapshot: DiscountSnapshot | null,
  ): string | null {
    if (!discountSnapshot) {
      return null;
    }

    // Extract discount code from snapshot (use first applied discount code)
    if (discountSnapshot.cartDiscounts.length > 0) {
      return discountSnapshot.cartDiscounts[0].discountCode;
    } else if (
      discountSnapshot.lineItems.some((item) => item.discounts.length > 0)
    ) {
      const firstDiscount = discountSnapshot.lineItems.find(
        (item) => item.discounts.length > 0,
      );
      return firstDiscount?.discounts[0].discountCode || null;
    }

    return null;
  }

  /**
   * Extract discount amount from discount snapshot
   */
  @Trace({ operation: "OrderDiscountExtractionService.extractDiscountAmount" })
  extractDiscountAmount(discountSnapshot: DiscountSnapshot | null): number {
    if (!discountSnapshot) {
      return 0;
    }

    return discountSnapshot.discountTotal;
  }

  /**
   * Extract discount information from snapshot
   */
  @Trace({ operation: "OrderDiscountExtractionService.extractDiscountInfo" })
  extractDiscountInfo(discountSnapshot: DiscountSnapshot | null): {
    discountCode: string | null;
    discountAmount: number;
  } {
    return {
      discountCode: this.extractDiscountCode(discountSnapshot),
      discountAmount: this.extractDiscountAmount(discountSnapshot),
    };
  }
}
