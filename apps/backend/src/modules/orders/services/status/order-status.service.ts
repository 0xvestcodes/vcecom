import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, orderItems, orders } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { AuditLogService } from "../../../../common/audit/audit-log.service";
import { ContextService } from "../../../../common/logging/context.service";
import { createErrorContext } from "../../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../../modules/database/database.module";
import type { Database } from "../../../../modules/database/db";
import { OrderEventsService } from "../../../events/order-events.service";
import {
  OrderCancelledEventPayload,
  OrderConfirmedEventPayload,
  OrderDeliveredEventPayload,
  OrderProcessingEventPayload,
  OrderShippedEventPayload,
} from "../../../events/order-events.types";
import { OrderResponseDto } from "../../dto/order-response.dto";
import {
  OrderStatus,
  UpdateOrderStatusDto,
} from "../../dto/update-order-status.dto";
import { OrderGstService } from "../gst/order-gst.service";
import { OrderValidationService } from "../validation/order-validation.service";

/**
 * Service responsible for order status management
 * Handles status transitions and validation
 */
@Injectable()
export class OrderStatusService {
  constructor(
    readonly _logger: PinoLogger,
    readonly _contextService: ContextService,
    private readonly validationService: OrderValidationService,
    private readonly gstService: OrderGstService,
    private readonly orderEventsService: OrderEventsService,
    private readonly auditLogService: AuditLogService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Validate status transition
   * Ensures status changes follow a valid workflow
   * @param currentStatus - Current order status
   * @param newStatus - New order status to transition to
   * @throws BadRequestException if transition is invalid
   */
  validateStatusTransition(
    currentStatus: string,
    newStatus: OrderStatus,
  ): void {
    const validTransitions: Record<string, OrderStatus[]> = {
      pending: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      confirmed: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      processing: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      shipped: [OrderStatus.DELIVERED],
      delivered: [OrderStatus.REFUNDED],
      cancelled: [], // Cannot transition from cancelled
      refunded: [], // Cannot transition from refunded
    };

    const allowedStatuses = validTransitions[currentStatus] || [];

    if (!allowedStatuses.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot change order status from '${currentStatus}' to '${newStatus}'. ` +
          `Valid transitions from '${currentStatus}': ${allowedStatuses.join(", ") || "none"}`,
      );
    }
  }

  /**
   * Update order status
   * Validates status transition and updates the order
   * @param userId - User ID
   * @param orderId - Order ID
   * @param updateStatusDto - Status update DTO
   * @returns Updated order with items and GST breakdown
   * @throws NotFoundException if order not found
   * @throws BadRequestException if status transition is invalid
   */
  async updateStatus(
    userId: string,
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    const customerId = await this.validationService.getCustomerId(userId);

    // Get current order
    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Validate status transition
    this.validateStatusTransition(order.status, updateStatusDto.status);

    // Update order status
    // Note: Inventory is decremented when order is PLACED (in finalizeOrderFromPayment)
    // and restored when order is CANCELLED (in OrderCancelService)
    // Status changes (including DELIVERED) do not affect inventory
    const [updatedOrder] = await this.db
      .update(orders)
      .set({
        status: updateStatusDto.status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    // Get order items
    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const gstBreakdown = await this.gstService.calculateOrderGstBreakdown(
      orderId,
      updatedOrder.shippingAddressId,
    );

    // Emit order lifecycle event based on status
    await this.emitStatusChangeEvent(updatedOrder, updateStatusDto.status);

    return {
      ...updatedOrder,
      gstBreakdown,
      items,
    } as OrderResponseDto;
  }

  /**
   * Update order status (admin - no user validation)
   */
  async updateStatusForAdmin(
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto,
    adminId?: string,
  ): Promise<OrderResponseDto> {
    // Get current order (no customer validation for admin)
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Validate status transition
    this.validateStatusTransition(order.status, updateStatusDto.status);

    // Update order status
    // Note: Inventory is decremented when order is PLACED (in finalizeOrderFromPayment)
    // and restored when order is CANCELLED (in OrderCancelService)
    // Status changes (including DELIVERED) do not affect inventory
    const [updatedOrder] = await this.db
      .update(orders)
      .set({
        status: updateStatusDto.status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    // Log audit event
    if (adminId) {
      await this.auditLogService.logOrderStatusChange(
        orderId,
        order.status,
        updateStatusDto.status,
        adminId,
        "admin",
      );
    }

    // Get order items
    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const gstBreakdown = await this.gstService.calculateOrderGstBreakdown(
      orderId,
      updatedOrder.shippingAddressId,
    );

    // Emit order lifecycle event based on status
    await this.emitStatusChangeEvent(updatedOrder, updateStatusDto.status);

    return {
      ...updatedOrder,
      gstBreakdown,
      items,
    } as OrderResponseDto;
  }

  /**
   * Emit order lifecycle event based on status change
   */
  private async emitStatusChangeEvent(
    order: typeof orders.$inferSelect,
    newStatus: OrderStatus,
  ): Promise<void> {
    const basePayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      timestamp: new Date(),
      metadata: {},
    };

    try {
      switch (newStatus) {
        case OrderStatus.CONFIRMED:
          await this.orderEventsService.emitOrderConfirmed(
            basePayload as OrderConfirmedEventPayload,
          );
          break;
        case OrderStatus.PROCESSING:
          await this.orderEventsService.emitOrderProcessing(
            basePayload as OrderProcessingEventPayload,
          );
          break;
        case OrderStatus.SHIPPED:
          await this.orderEventsService.emitOrderShipped(
            basePayload as OrderShippedEventPayload,
          );
          break;
        case OrderStatus.DELIVERED:
          await this.orderEventsService.emitOrderDelivered({
            ...basePayload,
            deliveredAt: new Date(),
          } as OrderDeliveredEventPayload);
          break;
        case OrderStatus.CANCELLED:
          await this.orderEventsService.emitOrderCancelled(
            basePayload as OrderCancelledEventPayload,
          );
          break;
        default:
          // No event for other statuses
          break;
      }
    } catch (error) {
      // Log but don't throw - event emission failure shouldn't break status update
      this._logger.warn(
        createErrorContext(
          this._contextService,
          "emitStatusChangeEvent",
          error,
          { orderId: order.id, newStatus },
        ),
        "Failed to emit order status change event",
      );
    }
  }
}
