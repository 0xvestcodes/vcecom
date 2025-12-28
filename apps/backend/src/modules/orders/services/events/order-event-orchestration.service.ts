import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import { OrderEventsService } from "../../../events/order-events.service";
import {
  OrderCreatedEventPayload,
  OrderPaymentCompletedEventPayload,
} from "../../../events/order-events.types";

/**
 * Service responsible for orchestrating order-related events
 */
@Injectable()
export class OrderEventOrchestrationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly orderEventsService: OrderEventsService,
  ) {}

  /**
   * Emit order created event
   */
  @Trace({ operation: "OrderEventOrchestrationService.emitOrderCreated" })
  async emitOrderCreated(payload: OrderCreatedEventPayload): Promise<void> {
    try {
      await this.orderEventsService.emitOrderCreated(payload);
      this.logger.debug(
        createLogContext(this.contextService, "emitOrderCreated", {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
        }),
        "Order created event emitted",
      );
    } catch (error) {
      // Log but don't throw - event emission failure shouldn't break order creation
      this.logger.warn(
        createErrorContext(this.contextService, "emitOrderCreated", error, {
          orderId: payload.orderId,
        }),
        "Failed to emit order created event",
      );
    }
  }

  /**
   * Emit order payment completed event
   */
  @Trace({
    operation: "OrderEventOrchestrationService.emitOrderPaymentCompleted",
  })
  async emitOrderPaymentCompleted(
    payload: OrderPaymentCompletedEventPayload,
  ): Promise<void> {
    try {
      await this.orderEventsService.emitPaymentCompleted(payload);
      this.logger.debug(
        createLogContext(this.contextService, "emitOrderPaymentCompleted", {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
        }),
        "Order payment completed event emitted",
      );
    } catch (error) {
      // Log but don't throw - event emission failure shouldn't break order creation
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "emitOrderPaymentCompleted",
          error,
          { orderId: payload.orderId },
        ),
        "Failed to emit order payment completed event",
      );
    }
  }
}
