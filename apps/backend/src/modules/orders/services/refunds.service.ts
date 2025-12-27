import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { and, desc, eq, orders, payments, refunds } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import Razorpay from "razorpay";
import { AppConfigService } from "../../../common/config/app.config.service";
import {
  MAX_REFUND_AMOUNT_MULTIPLIER,
  MIN_REFUND_AMOUNT_INR,
} from "../../../common/constants/orders.constants";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { NotificationsService } from "../../notifications/notifications.service";
import { NotificationType } from "../../notifications/types/notification.types";
import { RazorpayConfigService } from "../../payments/razorpay-config.service";
import { TimelineEventType } from "../dto/order-timeline.dto";
import { OrderTimelineService } from "./order-timeline.service";

@Injectable()
export class RefundsService implements OnModuleInit {
  private razorpay: Razorpay | null = null;

  constructor(
    private readonly logger: PinoLogger,
    private readonly razorpayConfigService: RazorpayConfigService,
    private readonly appConfigService: AppConfigService,
    private readonly timelineService: OrderTimelineService,
    private readonly notificationsService: NotificationsService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Initialize Razorpay on module initialization
   * Reads configuration from AppConfigService
   */
  onModuleInit() {
    const config = this.appConfigService.getRazorpayConfig();

    if (config.keyId && config.keySecret) {
      this.razorpay = this.razorpayConfigService.initialize({
        keyId: config.keyId,
        keySecret: config.keySecret,
      });
    }
  }

  /**
   * Get all refunds for an order
   * @param orderId - Order ID
   * @returns Array of refunds
   */
  async findByOrderId(orderId: string) {
    // Verify order exists
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const refundsList = await this.db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, orderId))
      .orderBy(desc(refunds.createdAt));

    return refundsList;
  }

  /**
   * Create a refund for an order
   * @param orderId - Order ID
   * @param amount - Refund amount
   * @param reason - Reason for refund
   * @returns Created refund
   */
  async create(orderId: string, amount: number, reason: string) {
    if (amount <= 0) {
      throw new BadRequestException("Refund amount must be greater than 0");
    }

    if (amount < MIN_REFUND_AMOUNT_INR) {
      throw new BadRequestException(
        `Refund amount must be at least ${MIN_REFUND_AMOUNT_INR} INR`,
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException("Refund reason is required");
    }

    // Get order
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Calculate total already refunded
    const existingRefunds = await this.db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, orderId));

    const totalRefunded = existingRefunds.reduce(
      (sum, refund) => sum + Number(refund.amount),
      0,
    );

    // Calculate refundable amount (exclude payment fee for partial refunds)
    // Payment fees are typically NOT refunded by payment gateways
    // Full refund: refund entire order total (includes fee)
    // Partial refund: exclude payment fee from refundable amount
    const paymentFeeInRupees = (order.paymentFee || 0) / 100;
    const isFullRefund = amount >= order.total - totalRefunded;
    const refundableAmount = isFullRefund
      ? order.total // Full refund includes fee
      : order.total - paymentFeeInRupees; // Partial refund excludes fee

    const maxRefundable = refundableAmount * MAX_REFUND_AMOUNT_MULTIPLIER;
    const remainingRefundable = maxRefundable - totalRefunded;

    if (amount > remainingRefundable) {
      const feeNote = isFullRefund
        ? ""
        : ` (Payment fee of ₹${paymentFeeInRupees.toFixed(2)} excluded from partial refund)`;
      throw new BadRequestException(
        `Refund amount exceeds remaining refundable amount of ₹${remainingRefundable.toFixed(2)}${feeNote}`,
      );
    }

    // Log refund calculation for audit
    this.logger.debug(
      {
        orderId,
        refundAmount: amount,
        orderTotal: order.total,
        paymentFee: paymentFeeInRupees,
        isFullRefund,
        refundableAmount,
        totalRefunded,
        remainingRefundable,
      },
      "Refund calculation - payment fee handling",
    );

    // Create refund record
    const [createdRefund] = await this.db
      .insert(refunds)
      .values({
        orderId,
        amount,
        reason: reason.trim(),
        status: "pending",
      })
      .returning();

    this.logger.info(
      {
        orderId,
        refundId: createdRefund.id,
        amount,
        reason,
      },
      "Refund created",
    );

    // Add timeline event
    await this.timelineService.addEvent(orderId, {
      type: TimelineEventType.REFUND_CREATED,
      title: "Refund Created",
      description: `Refund of ₹${amount} created. Reason: ${reason.trim()}`,
      actor: "admin",
      timestamp: createdRefund.createdAt,
      metadata: {
        refundId: createdRefund.id,
        amount,
        reason: reason.trim(),
        status: createdRefund.status,
      },
    });

    // Create notification for refund
    try {
      await this.notificationsService.createFromEvent({
        adminId: null, // Broadcast to all admins
        type: NotificationType.ORDER,
        title: "Refund Created",
        message: `Refund of ₹${amount.toFixed(2)} created for Order #${order.orderNumber || orderId}`,
        meta: {
          orderId,
          refundId: createdRefund.id,
          amount,
          reason: reason.trim(),
        },
      });
    } catch (error) {
      // Log but don't throw - notification failure shouldn't break refund creation
      this.logger.warn(
        {
          orderId,
          refundId: createdRefund.id,
          error,
        },
        "Failed to create refund notification",
      );
    }

    // Process refund asynchronously if payment provider is available
    if (order.razorpayOrderId && this.razorpay) {
      this.processRefund(createdRefund.id).catch((error) => {
        this.logger.error(
          {
            refundId: createdRefund.id,
            error,
          },
          "Failed to process refund",
        );
      });
    }

    return createdRefund;
  }

  /**
   * Process refund via payment provider
   * @param refundId - Refund ID
   * @returns Updated refund
   */
  async processRefund(refundId: string) {
    const [refund] = await this.db
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1);

    if (!refund) {
      throw new NotFoundException(`Refund with ID ${refundId} not found`);
    }

    if (refund.status !== "pending") {
      throw new BadRequestException(
        `Refund is already ${refund.status}, cannot process again`,
      );
    }

    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, refund.orderId))
      .limit(1);

    if (!order || !order.razorpayOrderId || !this.razorpay) {
      // Mark as failed if no payment provider
      await this.db
        .update(refunds)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, refundId));

      return refund;
    }

    try {
      // Get payment ID from payments table
      const [payment] = await this.db
        .select()
        .from(payments)
        .where(
          and(eq(payments.orderId, order.id), eq(payments.status, "captured")),
        )
        .limit(1);

      if (!payment || !payment.razorpayPaymentId) {
        throw new NotFoundException("Payment not found for refund");
      }

      // Process refund via Razorpay
      const razorpayRefund = await this.razorpay.payments.refund(
        payment.razorpayPaymentId,
        {
          amount: Math.round(refund.amount * 100), // Convert to paise
          notes: {
            reason: refund.reason,
            order_id: order.id,
          },
        },
      );

      // Update refund with provider refund ID
      const [updatedRefund] = await this.db
        .update(refunds)
        .set({
          status: "completed",
          providerRefundId: razorpayRefund.id,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, refundId))
        .returning();

      // Add timeline event
      await this.timelineService.addEvent(refund.orderId, {
        type: TimelineEventType.REFUND_PROCESSED,
        title: "Refund Processed",
        description: `Refund of ₹${refund.amount} has been processed`,
        actor: "system",
        timestamp: updatedRefund.processedAt || new Date(),
        metadata: {
          refundId: updatedRefund.id,
          providerRefundId: updatedRefund.providerRefundId,
        },
      });

      this.logger.info(
        {
          refundId,
          providerRefundId: razorpayRefund.id,
        },
        "Refund processed successfully",
      );

      return updatedRefund;
    } catch (error) {
      // Mark refund as failed
      await this.db
        .update(refunds)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, refundId));

      this.logger.error(
        {
          refundId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to process refund",
      );

      throw error;
    }
  }
}
