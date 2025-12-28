import { Injectable } from "@nestjs/common";
import { Trace } from "../../common/tracing/trace.decorator";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderResponseDto } from "./dto/order-response.dto";
import { OrderTimelineDto } from "./dto/order-timeline.dto";
import { OrderTrackingDto } from "./dto/order-tracking.dto";
import { PaymentIntentResponseDto } from "./dto/payment-intent-response.dto";
import {
  OrderStatus,
  UpdateOrderStatusDto,
} from "./dto/update-order-status.dto";
import { OrderCreationService } from "./services/order-creation.service";
import { OrderQueryService } from "./services/order-query.service";
import { OrderStatusService } from "./services/order-status.service";
import { OrderTimelineService } from "./services/order-timeline.service";
import { OrderTrackingService } from "./services/order-tracking.service";

/**
 * Orders Service - Orchestrator
 * Thin orchestrator that delegates to specialized services
 * No business logic, only coordination and API surface
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly creationService: OrderCreationService,
    private readonly queryService: OrderQueryService,
    private readonly statusService: OrderStatusService,
    private readonly timelineService: OrderTimelineService,
    private readonly trackingService: OrderTrackingService,
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
    return this.creationService.createCodOrder(
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
  async findOne(userId: string, orderId: string) {
    return this.queryService.findOne(userId, orderId);
  }

  /**
   * Get order by ID (for public access - e.g., order tracking)
   */
  @Trace({ operation: "OrdersService.findOnePublic" })
  async findOnePublic(orderId: string) {
    return this.queryService.findOnePublic(orderId);
  }

  /**
   * Get all orders for a customer
   */
  @Trace({ operation: "OrdersService.findAll" })
  async findAll(userId: string, status?: OrderStatus) {
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
  ) {
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
}
