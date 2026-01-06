import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq, orderItems, orders, payments } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { isCodPayment } from "../../../../common/constants/orders.constants";
import { DB_TOKEN } from "../../../../modules/database/database.module";
import type { Database } from "../../../../modules/database/db";
import { MarkOrderPaidResponseDto } from "../../../admin/dto/mark-order-paid.dto";
import { TimelineEventType } from "../../dto/order-timeline.dto";
import { OrderResponseBuilderService } from "../query/order-response-builder.service";
import { OrderTimelineService } from "../status/order-timeline.service";

@Injectable()
export class OrderPaymentService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly timelineService: OrderTimelineService,
    private readonly responseBuilderService: OrderResponseBuilderService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Mark a COD order as paid
   * @param orderId - Order ID
   * @param adminId - Admin user ID who marked the order as paid
   * @param adminName - Admin name (optional)
   * @param adminEmail - Admin email (optional)
   * @returns Updated order
   */
  async markAsPaid(
    orderId: string,
    adminId: string,
    adminName?: string,
    adminEmail?: string,
  ): Promise<MarkOrderPaidResponseDto> {
    // Get order
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check if order has a payment record
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .limit(1);

    if (!payment) {
      throw new BadRequestException(
        "Order does not have a payment record. Cannot mark as paid.",
      );
    }

    // Verify payment method is COD (case-insensitive)
    if (!isCodPayment(payment.method)) {
      throw new BadRequestException(
        `Order payment method is ${payment.method}, not COD. Only COD orders can be marked as paid manually.`,
      );
    }

    // Check if already paid
    if (payment.status === "captured") {
      throw new BadRequestException("Order is already marked as paid");
    }

    // Update payment status to captured
    await this.db
      .update(payments)
      .set({
        status: "captured",
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    // Update order status to confirmed if it's still pending (consistent with online payment flow)
    if (order.status === "pending") {
      await this.db
        .update(orders)
        .set({
          status: "confirmed",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    }

    // Add timeline event
    await this.timelineService.addEvent(orderId, {
      type: TimelineEventType.ORDER_MARKED_PAID,
      title: "Order Marked as Paid",
      description: `COD order marked as paid by admin${adminName ? ` (${adminName})` : ""}`,
      actor: "admin",
      actorId: adminId,
      actorName: adminName,
      actorEmail: adminEmail,
      timestamp: new Date(),
    });

    // Fetch updated order
    const [updatedOrder] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!updatedOrder) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Get order items
    const orderItemsList = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Calculate GST breakdown
    const gstBreakdown =
      await this.responseBuilderService.calculateGstBreakdownFromOrderItems(
        orderId,
        updatedOrder.shippingAddressId,
      );

    this.logger.info(
      {
        orderId,
        adminId,
        adminName,
        adminEmail,
        paymentId: payment.id,
        paymentMethod: payment.method,
        previousStatus: payment.status,
        orderStatus: updatedOrder.status,
      },
      "COD order marked as paid by admin",
    );

    return {
      id: updatedOrder.id,
      customerId: updatedOrder.customerId,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      subtotal: updatedOrder.subtotal,
      gstAmount: updatedOrder.gstAmount,
      gstBreakdown,
      shippingCost: updatedOrder.shippingCost,
      paymentFee: updatedOrder.paymentFee ?? undefined,
      paymentMethod: updatedOrder.paymentMethod ?? null,
      paymentFeeBreakdown:
        (updatedOrder.paymentFeeBreakdown as {
          method: string;
          chargeType: string;
          calculatedFee: number;
          flatAmount?: number;
          percentage?: number;
          mixMin?: number;
          mixCap?: number;
        } | null) || null,
      total: updatedOrder.total,
      razorpayOrderId: updatedOrder.razorpayOrderId ?? null,
      shippingProvider: updatedOrder.shippingProvider ?? null,
      shippingAddressId: updatedOrder.shippingAddressId,
      billingAddressId: updatedOrder.billingAddressId,
      items: orderItemsList,
      createdAt: updatedOrder.createdAt,
      updatedAt: updatedOrder.updatedAt,
      archived: updatedOrder.archived ?? false,
      archivedAt: updatedOrder.archivedAt ?? null,
      archivedBy: updatedOrder.archivedBy ?? null,
      discountCode: updatedOrder.discountCode ?? undefined,
      discountAmount: updatedOrder.discountAmount ?? undefined,
    };
  }
}
