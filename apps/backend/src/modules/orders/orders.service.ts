import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq, payments } from "@vcecom/db";
import { Trace } from "../../common/tracing/trace.decorator";
import { DB_TOKEN } from "../database/database.module";
import type { Database } from "../database/db";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderResponseDto } from "./dto/order-response.dto";
import { OrderTimelineDto } from "./dto/order-timeline.dto";
import { OrderTrackingDto } from "./dto/order-tracking.dto";
import { PaymentIntentResponseDto } from "./dto/payment-intent-response.dto";
import {
  OrderStatus,
  UpdateOrderStatusDto,
} from "./dto/update-order-status.dto";
import { OrderCodFlowService } from "./services/creation/order-cod-flow.service";
import { OrderCreationService } from "./services/creation/order-creation.service";
import { OrderPaymentIntentFlowService } from "./services/creation/order-payment-intent-flow.service";
import { OrderQueryService } from "./services/query/order-query.service";
import { OrderStatusService } from "./services/status/order-status.service";
import { OrderTimelineService } from "./services/status/order-timeline.service";
import { OrderTrackingService } from "./services/status/order-tracking.service";

/**
 * Orders Service - Orchestrator
 * Thin orchestrator that delegates to specialized services
 * No business logic, only coordination and API surface
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly creationService: OrderCreationService,
    private readonly codFlowService: OrderCodFlowService,
    readonly _paymentIntentFlowService: OrderPaymentIntentFlowService,
    private readonly queryService: OrderQueryService,
    private readonly statusService: OrderStatusService,
    private readonly timelineService: OrderTimelineService,
    private readonly trackingService: OrderTrackingService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  // ============================================================================
  // Public API Methods - Order Lifecycle
  // ============================================================================

  /**
   * Create payment intent for checkout
   * Orders are now created only after payment confirmation via webhook
   * Supports both authenticated and guest checkout
   */
  @Trace({ operation: "OrdersService.create" })
  async create(
    userId: string | null,
    createOrderDto: CreateOrderDto,
    sessionId?: string | null,
  ): Promise<PaymentIntentResponseDto> {
    return this.creationService.create(userId, createOrderDto, sessionId);
  }

  /**
   * Create order directly for COD (Cash on Delivery) orders
   * COD orders skip payment intent creation and go straight to order creation
   */
  @Trace({ operation: "OrdersService.createCodOrder" })
  async createCodOrder(
    checkoutSessionId: string,
    userId: string | null,
    createOrderDto: CreateOrderDto,
    sessionId: string | null,
  ): Promise<OrderResponseDto> {
    return this.codFlowService.createCodOrder(
      checkoutSessionId,
      userId,
      createOrderDto,
      sessionId,
    );
  }

  /**
   * Finalize order from payment confirmation (webhook-driven)
   * Creates order only after payment is confirmed
   * Uses payment-scoped idempotency to prevent duplicate orders
   */
  @Trace({ operation: "OrdersService.finalizeOrderFromPayment" })
  async finalizeOrderFromPayment(
    checkoutSessionId: string,
    paymentIntentId: string,
    provider: string = "razorpay",
  ): Promise<OrderResponseDto> {
    return this.creationService.finalizeOrderFromPayment(
      checkoutSessionId,
      paymentIntentId,
      provider,
    );
  }

  // ============================================================================
  // Public API Methods - Order Retrieval
  // ============================================================================

  /**
   * Get order by ID (for authenticated customer)
   */
  @Trace({ operation: "OrdersService.findOne" })
  async findOne(userId: string, orderId: string): Promise<OrderResponseDto> {
    return this.queryService.findOne(userId, orderId);
  }

  /**
   * Get order by ID (for public access - e.g., order tracking)
   */
  @Trace({ operation: "OrdersService.findOnePublic" })
  async findOnePublic(orderId: string): Promise<OrderResponseDto> {
    return this.queryService.findOnePublic(orderId);
  }

  /**
   * Get all orders for a customer
   */
  @Trace({ operation: "OrdersService.findAll" })
  async findAll(userId: string, status?: OrderStatus): Promise<OrderResponseDto[]> {
    return this.queryService.findAll(userId, status);
  }

  // ============================================================================
  // Public API Methods - Order Management
  // ============================================================================

  /**
   * Update order status
   */
  @Trace({ operation: "OrdersService.updateStatus" })
  async updateStatus(
    userId: string,
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    return this.statusService.updateStatus(userId, orderId, updateStatusDto);
  }

  // ============================================================================
  // Public API Methods - Order Tracking & Timeline
  // ============================================================================

  /**
   * Get order tracking information
   */
  @Trace({ operation: "OrdersService.getTracking" })
  async getTracking(
    userId: string,
    orderId: string,
  ): Promise<OrderTrackingDto> {
    return this.trackingService.getTracking(userId, orderId);
  }

  /**
   * Get order timeline
   */
  @Trace({ operation: "OrdersService.getTimeline" })
  async getTimeline(
    userId: string,
    orderId: string,
  ): Promise<OrderTimelineDto> {
    return this.timelineService.getTimeline(userId, orderId);
  }

  /**
   * Retry payment for a failed order
   * Creates a new payment intent for orders that failed payment
   * @param userId - User ID
   * @param orderId - Order ID
   * @returns Payment intent response
   */
  @Trace({ operation: "OrdersService.retryPayment" })
  async retryPayment(
    userId: string,
    orderId: string,
  ): Promise<PaymentIntentResponseDto> {
    // Get order and validate ownership
    const order = await this.queryService.findOne(userId, orderId);

    // Check if order is already paid
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .limit(1);

    if (payment && payment.status === "captured") {
      throw new BadRequestException(
        "Order is already paid. Cannot retry payment for a paid order.",
      );
    }

    // Check order status - only allow retry for pending/failed orders
    const allowedStatuses = ["pending", "failed"];
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot retry payment for order with status: ${order.status}. ` +
          `Payment retry is only allowed for orders with status: ${allowedStatuses.join(", ")}`,
      );
    }

    // Get checkout session ID from order metadata or create new checkout flow
    // For retry, we need to recreate the checkout flow with the same order details
    // This is a simplified implementation - in production, you might want to store
    // checkout session ID with the order for easier retry

    // For now, throw an error indicating that retry requires recreating checkout
    // In a full implementation, you would:
    // 1. Store checkout session ID with order
    // 2. Retrieve checkout metadata
    // 3. Create new payment intent with same details
    throw new BadRequestException(
      "Payment retry requires checkout session recreation. " +
        "Please initiate a new checkout with the same order items.",
    );
  }
}
