import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, orderItems, orders, payments } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { AuditLogService } from "../../../../common/audit/audit-log.service";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { BundleCartItemMetadata } from "../../../carts/dto/bundle-cart-item.dto";
import { DB_TOKEN } from "../../../database/database.module";
import type { Database } from "../../../database/db";
import { BundlePricingService } from "../../../pricing/services/bundle-pricing.service";
import { InventoryStore } from "../../../redis-store/stores/inventory-store";
import { CancelOrderDto } from "../../dto/cancel-order.dto";
import { OrderResponseDto } from "../../dto/order-response.dto";
import { TimelineEventType } from "../../dto/order-timeline.dto";
import { OrderGstService } from "../gst/order-gst.service";
import { RefundsService } from "../payment/refunds.service";
import { OrderTimelineService } from "../status/order-timeline.service";
import { OrderValidationService } from "../validation/order-validation.service";

/**
 * Service responsible for order cancellation
 * Handles validation, inventory release, refunds, and status updates
 */
@Injectable()
export class OrderCancelService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly validationService: OrderValidationService,
    private readonly inventoryStore: InventoryStore,
    private readonly timelineService: OrderTimelineService,
    private readonly gstService: OrderGstService,
    private readonly bundlePricingService: BundlePricingService,
    private readonly refundsService: RefundsService,
    private readonly auditLogService: AuditLogService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Validate if order can be cancelled
   * @param orderStatus - Current order status
   * @param isAdmin - Whether the requester is an admin
   * @throws BadRequestException if cancellation is not allowed
   */
  private validateCancellation(orderStatus: string, isAdmin: boolean): void {
    // Terminal states cannot be cancelled
    if (orderStatus === "cancelled") {
      throw new BadRequestException("Order is already cancelled");
    }

    if (orderStatus === "refunded") {
      throw new BadRequestException(
        "Order is already refunded and cannot be cancelled",
      );
    }

    // Customer cancellation rules
    if (!isAdmin) {
      const allowedStatuses = ["pending", "confirmed", "processing"];
      if (!allowedStatuses.includes(orderStatus)) {
        throw new BadRequestException(
          `Order cannot be cancelled. Current status: ${orderStatus}. ` +
            `Customers can only cancel orders in: ${allowedStatuses.join(", ")}`,
        );
      }
    }
    // Admin can cancel from any status except cancelled/refunded (already checked above)
  }

  /**
   * Release inventory back to available stock
   * @param orderId - Order ID
   */
  private async releaseInventory(orderId: string): Promise<void> {
    try {
      // Get order items
      const items = await this.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      for (const item of items) {
        // Check if item has bundle metadata
        if (item.metadata) {
          const metadata = item.metadata as BundleCartItemMetadata | null;
          if (metadata?.type === "bundle" && metadata.selections) {
            // Handle bundle items - release inventory for all variants in bundle
            const variantQuantities =
              this.bundlePricingService.flattenBundleSelections(
                metadata.selections,
                item.quantity,
              );

            for (const vq of variantQuantities) {
              await this.inventoryStore.incrementInventoryInDatabase(
                vq.variantId,
                vq.quantity, // Positive value to add back to inventory
              );
            }
          } else {
            // Regular variant item
            await this.inventoryStore.incrementInventoryInDatabase(
              item.productVariantId,
              item.quantity, // Positive value to add back to inventory
            );
          }
        } else {
          // Regular variant item (no metadata)
          await this.inventoryStore.incrementInventoryInDatabase(
            item.productVariantId,
            item.quantity, // Positive value to add back to inventory
          );
        }
      }

      this.logger.info(
        createLogContext(this.contextService, "releaseInventory", {
          orderId,
          itemsCount: items.length,
        }),
        "Inventory released for cancelled order",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "releaseInventory", error, {
          orderId,
        }),
        "Failed to release inventory for cancelled order",
      );
      // Don't throw - inventory release failure shouldn't block cancellation
      // Can be reconciled later
    }
  }

  /**
   * Cancel order (customer)
   * @param userId - User ID
   * @param orderId - Order ID
   * @param cancelDto - Cancellation details
   * @returns Updated order
   */
  async cancelOrder(
    userId: string,
    orderId: string,
    cancelDto: CancelOrderDto,
  ): Promise<OrderResponseDto> {
    const customerId = await this.validationService.getCustomerId(userId);

    // Get order and validate ownership
    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Validate cancellation
    this.validateCancellation(order.status, false);

    return this.processCancellation(orderId, order, cancelDto, userId, false);
  }

  /**
   * Cancel order (admin)
   * @param orderId - Order ID
   * @param cancelDto - Cancellation details
   * @param adminId - Admin user ID
   * @returns Updated order
   */
  async cancelOrderForAdmin(
    orderId: string,
    cancelDto: CancelOrderDto,
    adminId: string,
  ): Promise<OrderResponseDto> {
    // Get order (no customer validation for admin)
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Validate cancellation (admin rules)
    this.validateCancellation(order.status, true);

    return this.processCancellation(orderId, order, cancelDto, adminId, true);
  }

  /**
   * Process order cancellation
   * @param orderId - Order ID
   * @param order - Order object
   * @param cancelDto - Cancellation details
   * @param actorId - User ID who cancelled
   * @param isAdmin - Whether actor is admin
   * @returns Updated order
   */
  private async processCancellation(
    orderId: string,
    order: typeof orders.$inferSelect,
    cancelDto: CancelOrderDto,
    actorId: string,
    isAdmin: boolean,
  ): Promise<OrderResponseDto> {
    // Release inventory back to available stock
    await this.releaseInventory(orderId);

    // Check if payment was captured and handle refund
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(
        and(eq(payments.orderId, orderId), eq(payments.status, "captured")),
      )
      .limit(1);

    if (payment && cancelDto.refundRequested !== false) {
      // Payment was captured - create refund automatically
      try {
        const refundAmount = payment.amount / 100; // Convert from paise to rupees
        const refundReason =
          cancelDto.reason ||
          `Order cancelled${isAdmin ? " by admin" : " by customer"}`;

        await this.refundsService.create(orderId, refundAmount, refundReason);

        this.logger.info(
          createLogContext(this.contextService, "cancelOrder", {
            orderId,
            paymentId: payment.id,
            refundAmount,
            refundReason,
          }),
          "Refund created automatically for cancelled order with captured payment",
        );
      } catch (error) {
        // Log error but don't fail cancellation - refund can be processed manually later
        this.logger.error(
          createErrorContext(this.contextService, "cancelOrder", error, {
            orderId,
            paymentId: payment.id,
          }),
          "Failed to create refund for cancelled order - manual refund processing required",
        );
      }
    }

    // Update order status to cancelled
    const [updatedOrder] = await this.db
      .update(orders)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    // Log audit event
    await this.auditLogService.logOrderCancellation(
      orderId,
      actorId,
      isAdmin ? "admin" : "customer",
      cancelDto.reason,
    );

    // Create timeline event
    await this.timelineService.addEvent(orderId, {
      type: TimelineEventType.ORDER_CANCELLED,
      title: "Order Cancelled",
      description: cancelDto.reason
        ? `Order cancelled: ${cancelDto.reason}`
        : "Order has been cancelled",
      actor: isAdmin ? "admin" : "customer",
      actorId,
      timestamp: new Date(),
      metadata: {
        reason: cancelDto.reason || null,
        refundRequested: cancelDto.refundRequested || false,
      },
    });

    // Get order items
    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Get GST breakdown
    const gstBreakdown = await this.gstService.calculateOrderGstBreakdown(
      orderId,
      updatedOrder.shippingAddressId,
    );

    this.logger.info(
      createLogContext(this.contextService, "cancelOrder", {
        orderId,
        orderNumber: order.orderNumber,
        previousStatus: order.status,
        actorId,
        isAdmin,
      }),
      "Order cancelled successfully",
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
      items,
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
