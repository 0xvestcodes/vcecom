import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { COD_PAYMENT_METHOD } from "../../../../common/constants/orders.constants";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { NotificationsService } from "../../../notifications/notifications.service";
import { NotificationType } from "../../../notifications/types/notification.types";

/**
 * Service responsible for order-related notifications
 */
@Injectable()
export class OrderNotificationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Send order confirmation notification
   */
  @Trace({ operation: "OrderNotificationService.sendOrderConfirmation" })
  async sendOrderConfirmation(
    orderId: string,
    orderNumber: string,
    total: number,
    customerId: string | null,
    paymentMethod?: string,
  ): Promise<void> {
    try {
      const isCod = paymentMethod === COD_PAYMENT_METHOD;
      const title = isCod ? "New COD Order Received" : "New Order Received";
      const message = `${isCod ? "COD " : ""}Order #${orderNumber} has been placed for ₹${total.toFixed(2)}`;

      await this.notificationsService.createFromEvent({
        adminId: null, // Broadcast to all admins
        type: NotificationType.ORDER,
        title,
        message,
        meta: {
          orderId,
          orderNumber,
          total,
          customerId,
          ...(isCod && { paymentMethod: COD_PAYMENT_METHOD }),
        },
      });

      this.logger.debug(
        createLogContext(this.contextService, "sendOrderConfirmation", {
          orderId,
          orderNumber,
          total,
        }),
        "Order confirmation notification sent",
      );
    } catch (error) {
      // Log but don't throw - notification failure shouldn't break order creation
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "sendOrderConfirmation",
          error,
          { orderId, orderNumber },
        ),
        "Failed to send order confirmation notification",
      );
    }
  }

  /**
   * Send payment completed notification
   */
  @Trace({ operation: "OrderNotificationService.sendPaymentCompleted" })
  async sendPaymentCompleted(
    orderId: string,
    orderNumber: string,
    total: number,
    customerId: string | null,
  ): Promise<void> {
    try {
      await this.notificationsService.createFromEvent({
        adminId: null, // Broadcast to all admins
        type: NotificationType.ORDER,
        title: "Order Payment Completed",
        message: `Payment for Order #${orderNumber} (₹${total.toFixed(2)}) has been completed`,
        meta: {
          orderId,
          orderNumber,
          total,
          customerId,
        },
      });

      this.logger.debug(
        createLogContext(this.contextService, "sendPaymentCompleted", {
          orderId,
          orderNumber,
        }),
        "Payment completed notification sent",
      );
    } catch (error) {
      // Log but don't throw - notification failure shouldn't break order creation
      this.logger.warn(
        createErrorContext(this.contextService, "sendPaymentCompleted", error, {
          orderId,
          orderNumber,
        }),
        "Failed to send payment completed notification",
      );
    }
  }
}
