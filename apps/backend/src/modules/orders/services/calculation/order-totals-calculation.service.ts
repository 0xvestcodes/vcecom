import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { calculateGstBreakdown } from "../../../../common/utils/gst.utils";
import { OrderValidationService } from "../validation/order-validation.service";
import { OrderCalculationService } from "./order-calculation.service";

/**
 * Service responsible for calculating order totals from cart items
 * Used during order finalization when recalculating from cart data
 */
@Injectable()
export class OrderTotalsCalculationService {
  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
    private readonly validationService: OrderValidationService,
    readonly _calculationService: OrderCalculationService,
  ) {}

  /**
   * Calculate order totals from cart items (for order finalization)
   */
  @Trace({
    operation: "OrderTotalsCalculationService.calculateTotalsFromCartItems",
  })
  async calculateTotalsFromCartItems(
    cartItemsWithVariants: Array<{
      price: number;
      quantity: number;
      productGstRate: number;
    }>,
    buyerState: string,
  ): Promise<{
    subtotal: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    totalGstAmount: number;
  }> {
    const sellerState = this.validationService.getSellerState();
    const _isIntraState = sellerState === buyerState;

    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    for (const item of cartItemsWithVariants) {
      const itemSubtotal = item.price * item.quantity;
      subtotal += itemSubtotal;

      const gstBreakdown = calculateGstBreakdown(
        itemSubtotal,
        item.productGstRate,
        sellerState,
        buyerState,
      );
      totalCgst += gstBreakdown.cgst;
      totalSgst += gstBreakdown.sgst;
      totalIgst += gstBreakdown.igst;
    }

    const totalGstAmount = totalCgst + totalSgst + totalIgst;

    return {
      subtotal,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGstAmount,
    };
  }
}
