import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { OrderEventPayload, OrderEventType } from "./order-events.types";

/**
 * Order Events Service
 * Emits order lifecycle events using EventEmitter2
 */
@Injectable()
export class OrderEventsService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Emit order event
   */
  async emit(
    eventType: OrderEventType,
    payload: OrderEventPayload,
  ): Promise<void> {
    try {
      this.eventEmitter.emit(eventType, payload);

      this.logger.debug(
        createLogContext(this.contextService, "emit", {
          eventType,
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
        }),
        `Emitted order event: ${eventType}`,
      );
    } catch (error) {
      // Don't throw - event emission failure shouldn't break the operation
      this.logger.warn(
        createErrorContext(this.contextService, "emit", error, {
          eventType,
          orderId: payload.orderId,
        }),
        `Failed to emit order event ${eventType}`,
      );
    }
  }

  /**
   * Emit order created event
   */
  async emitOrderCreated(payload: OrderEventPayload): Promise<void> {
    await this.emit(OrderEventType.ORDER_CREATED, payload);
  }

  /**
   * Emit order confirmed event
   */
  async emitOrderConfirmed(payload: OrderEventPayload): Promise<void> {
    await this.emit(OrderEventType.ORDER_CONFIRMED, payload);
  }

  /**
   * Emit order processing event
   */
  async emitOrderProcessing(payload: OrderEventPayload): Promise<void> {
    await this.emit(OrderEventType.ORDER_PROCESSING, payload);
  }

  /**
   * Emit order shipped event
   */
  async emitOrderShipped(payload: OrderEventPayload): Promise<void> {
    await this.emit(OrderEventType.ORDER_SHIPPED, payload);
  }

  /**
   * Emit order delivered event
   */
  async emitOrderDelivered(payload: OrderEventPayload): Promise<void> {
    await this.emit(OrderEventType.ORDER_DELIVERED, payload);
  }

  /**
   * Emit order cancelled event
   */
  async emitOrderCancelled(payload: OrderEventPayload): Promise<void> {
    await this.emit(OrderEventType.ORDER_CANCELLED, payload);
  }

  /**
   * Emit order payment completed event
   */
  async emitPaymentCompleted(payload: OrderEventPayload): Promise<void> {
    await this.emit(OrderEventType.ORDER_PAYMENT_COMPLETED, payload);
  }

  /**
   * Emit order payment failed event
   */
  async emitPaymentFailed(payload: OrderEventPayload): Promise<void> {
    await this.emit(OrderEventType.ORDER_PAYMENT_FAILED, payload);
  }

  /**
   * Emit order refund initiated event
   */
  async emitRefundInitiated(payload: OrderEventPayload): Promise<void> {
    await this.emit(OrderEventType.ORDER_REFUND_INITIATED, payload);
  }

  /**
   * Emit order refund completed event
   */
  async emitRefundCompleted(payload: OrderEventPayload): Promise<void> {
    await this.emit(OrderEventType.ORDER_REFUND_COMPLETED, payload);
  }
}
