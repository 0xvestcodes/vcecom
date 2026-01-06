import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq, orderItems, orders } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import { createLogContext } from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import type { Database } from "../../../../modules/database/db";
import { DB_TOKEN } from "../../../database/database.module";
import { CheckoutStore } from "../../../redis-store/stores/checkout-store";
import { OrderResponseDto } from "../../dto/order-response.dto";
import { OrderCheckoutSessionService } from "../checkout/order-checkout-session.service";
import { OrderPersistenceService } from "../persistence/order-persistence.service";
import { OrderResponseBuilderService } from "../query/order-response-builder.service";

/**
 * Service responsible for order idempotency checking
 * Handles payment intent to order mapping and duplicate order detection
 */
@Injectable()
export class OrderIdempotencyService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly checkoutSessionService: OrderCheckoutSessionService,
    private readonly responseBuilderService: OrderResponseBuilderService,
    private readonly checkoutStore: CheckoutStore,
    private readonly persistenceService: OrderPersistenceService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Check if order already exists for payment intent (idempotency check)
   */
  @Trace({ operation: "OrderIdempotencyService.checkExistingOrder" })
  async checkExistingOrder(
    checkoutSessionId: string,
    paymentIntentId: string,
    provider: string,
  ): Promise<OrderResponseDto | null> {
    // Check payment-scoped idempotency first
    const existingOrderId =
      await this.checkoutSessionService.getOrderByPaymentIntent(
        provider,
        paymentIntentId,
      );

    if (!existingOrderId) {
      return null;
    }

    // Order already exists for this payment intent - return existing order
    this.logger.debug(
      createLogContext(this.contextService, "checkExistingOrder", {
        paymentIntentId,
        orderId: existingOrderId,
        checkoutSessionId,
        provider,
      }),
      "Order already exists for payment intent",
    );

    // Fetch and return existing order
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, existingOrderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException(
        `Order ${existingOrderId} not found for payment intent ${paymentIntentId}`,
      );
    }

    // Get order items for response
    const orderItemsList = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    // Build order response with GST breakdown
    const gstBreakdown =
      await this.responseBuilderService.calculateGstBreakdownFromOrderItems(
        order.id,
        order.shippingAddressId,
      );

    return {
      id: order.id,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      status: order.status,
      subtotal: order.subtotal,
      gstAmount: order.gstAmount,
      gstBreakdown,
      shippingCost: order.shippingCost,
      paymentFee: order.paymentFee ?? undefined,
      paymentMethod: order.paymentMethod ?? null,
      paymentFeeBreakdown:
        (order.paymentFeeBreakdown as {
          method: string;
          chargeType: string;
          calculatedFee: number;
          flatAmount?: number;
          percentage?: number;
          mixMin?: number;
          mixCap?: number;
        } | null) || null,
      total: order.total,
      razorpayOrderId: order.razorpayOrderId ?? null,
      shippingProvider: order.shippingProvider ?? null,
      shippingAddressId: order.shippingAddressId,
      billingAddressId: order.billingAddressId,
      items: orderItemsList,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      archived: order.archived ?? false,
      archivedAt: order.archivedAt ?? null,
      archivedBy: order.archivedBy ?? null,
      discountCode: order.discountCode ?? undefined,
      discountAmount: order.discountAmount ?? undefined,
    };
  }

  /**
   * Create payment-scoped idempotency mapping
   * Returns the order ID that was mapped (may be different if concurrent creation occurred)
   * If concurrent creation detected, deletes the duplicate order and returns the existing order ID
   */
  @Trace({ operation: "OrderIdempotencyService.createOrderMapping" })
  async createOrderMapping(
    provider: string,
    paymentIntentId: string,
    orderId: string,
    checkoutSessionId: string,
  ): Promise<{
    mappedOrderId: string;
    isConcurrent: boolean;
  }> {
    // Atomically create payment-scoped idempotency mapping
    // This ensures exactly one order per payment intent
    const mappedOrderId = await this.checkoutStore.createOrderFromPayment(
      provider,
      paymentIntentId,
      orderId,
    );

    // If mapping returned different order ID, another process created it concurrently
    if (mappedOrderId !== orderId) {
      this.logger.warn(
        createLogContext(this.contextService, "createOrderMapping", {
          orderId,
          mappedOrderId,
          paymentIntentId,
          checkoutSessionId,
          provider,
        }),
        "Concurrent order creation detected, using existing order",
      );
      // Delete the duplicate order we just created
      await this.persistenceService.deleteOrder(orderId);
      return {
        mappedOrderId,
        isConcurrent: true,
      };
    }

    return {
      mappedOrderId,
      isConcurrent: false,
    };
  }
}
