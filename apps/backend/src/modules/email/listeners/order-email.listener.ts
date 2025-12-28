import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import {
  OrderDeliveredEventPayload,
  OrderEventType,
  OrderShippedEventPayload,
} from "../../events/order-events.types";
import { EmailService } from "../email.service";

/**
 * Order Email Listener
 * Listens to order lifecycle events and sends corresponding emails
 */
@Injectable()
export class OrderEmailListener {
  constructor(
    readonly _emailService: EmailService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  @OnEvent(OrderEventType.ORDER_CREATED)
  async handleOrderCreated(payload: {
    orderId: string;
    orderNumber: string;
    customerId?: string | null;
    total: number;
    itemsCount: number;
  }) {
    try {
      // Get customer email from order/customer data
      // For now, we'll need to fetch it from the database
      // This is a simplified version - you may need to pass email in payload
      this.logger.debug(
        createLogContext(this.contextService, "handleOrderCreated", {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
        }),
        "Order created event received - email would be sent here",
      );
      // TODO: Fetch customer email and send order confirmation
      // await this.emailService.sendOrderConfirmation(customerEmail, orderData);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "handleOrderCreated", error, {
          orderId: payload.orderId,
        }),
        "Failed to handle order created event",
      );
    }
  }

  @OnEvent(OrderEventType.ORDER_SHIPPED)
  async handleOrderShipped(payload: OrderShippedEventPayload) {
    try {
      this.logger.debug(
        createLogContext(this.contextService, "handleOrderShipped", {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
        }),
        "Order shipped event received - email would be sent here",
      );
      // TODO: Fetch customer email and send shipping notification
      // await this.emailService.sendOrderShipped(customerEmail, {
      //   orderNumber: payload.orderNumber,
      //   orderId: payload.orderId,
      //   trackingNumber: payload.trackingNumber,
      //   awbNumber: payload.awbNumber,
      //   courierName: payload.courierName,
      // });
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "handleOrderShipped", error, {
          orderId: payload.orderId,
        }),
        "Failed to handle order shipped event",
      );
    }
  }

  @OnEvent(OrderEventType.ORDER_DELIVERED)
  async handleOrderDelivered(payload: OrderDeliveredEventPayload) {
    try {
      this.logger.debug(
        createLogContext(this.contextService, "handleOrderDelivered", {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
        }),
        "Order delivered event received - email would be sent here",
      );
      // TODO: Fetch customer email and send delivery notification
      // await this.emailService.sendOrderDelivered(customerEmail, {
      //   orderNumber: payload.orderNumber,
      //   orderId: payload.orderId,
      //   deliveredAt: payload.deliveredAt,
      // });
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "handleOrderDelivered", error, {
          orderId: payload.orderId,
        }),
        "Failed to handle order delivered event",
      );
    }
  }
}
