import { Inject, Injectable } from "@nestjs/common";
import { addresses, eq, orderItems, orders } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { calculateGstBreakdown } from "../../../../common/utils/gst.utils";
import type { Database } from "../../../../modules/database/db";
import { DB_TOKEN } from "../../../database/database.module";
import { OrderResponseDto } from "../../dto/order-response.dto";
import { OrderValidationService } from "../validation/order-validation.service";

/**
 * Service responsible for building order response DTOs
 * Handles GST breakdown calculation and response construction
 */
@Injectable()
export class OrderResponseBuilderService {
  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
    private readonly validationService: OrderValidationService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Calculate GST breakdown from order items
   */
  @Trace({ operation: "OrderResponseBuilderService.calculateGstBreakdown" })
  async calculateGstBreakdownFromOrderItems(
    orderId: string,
    shippingAddressId: string,
  ): Promise<{
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
    isIntraState: boolean;
  }> {
    const sellerState = this.validationService.getSellerState();

    // Get shipping address to determine buyer state
    const [shippingAddress] = await this.db
      .select()
      .from(addresses)
      .where(eq(addresses.id, shippingAddressId))
      .limit(1);
    const buyerState = shippingAddress?.state || sellerState;
    const isIntraState = sellerState === buyerState;

    // Get order items
    const orderItemsList = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Calculate GST breakdown from order items
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    for (const orderItem of orderItemsList) {
      const itemSubtotal = orderItem.price * orderItem.quantity;
      const gstBreakdown = calculateGstBreakdown(
        itemSubtotal,
        orderItem.gstRate,
        sellerState,
        buyerState,
      );
      totalCgst += gstBreakdown.cgst;
      totalSgst += gstBreakdown.sgst;
      totalIgst += gstBreakdown.igst;
    }

    // Get order to get total GST amount
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    return {
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      totalGst: order?.gstAmount || totalCgst + totalSgst + totalIgst,
      isIntraState,
    };
  }

  /**
   * Build order response DTO from order data
   */
  @Trace({ operation: "OrderResponseBuilderService.buildOrderResponse" })
  async buildOrderResponse(
    orderId: string,
    orderNumber: string,
    customerId: string,
    subtotal: number,
    totalGstAmount: number,
    shippingCost: number,
    total: number,
    paymentFee: number,
    paymentMethod: string | null,
    paymentFeeBreakdown: unknown,
    shippingAddressId: string,
    billingAddressId: string,
    discountCode: string | null,
    discountAmount: number,
    paymentIntentId?: string | null,
  ): Promise<OrderResponseDto> {
    // Get order items
    const orderItemsList = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Calculate GST breakdown
    const gstBreakdown = await this.calculateGstBreakdownFromOrderItems(
      orderId,
      shippingAddressId,
    );

    // Build order response
    const orderResponse: OrderResponseDto = {
      id: orderId,
      customerId,
      orderNumber,
      status: "pending",
      subtotal,
      gstAmount: totalGstAmount,
      gstBreakdown,
      shippingCost,
      paymentFee: paymentFee > 0 ? paymentFee : undefined,
      paymentMethod: paymentMethod || null,
      paymentFeeBreakdown: paymentFeeBreakdown || null,
      total,
      razorpayOrderId: paymentIntentId || null,
      shippingProvider: null,
      shippingAddressId,
      billingAddressId,
      discountCode,
      discountAmount,
      items: orderItemsList,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as OrderResponseDto;

    return orderResponse;
  }
}
