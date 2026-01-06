import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import {
  CustomerEventPayload,
  CustomerEventType,
} from "./customer-events.types";

/**
 * Customer Events Service
 * Emits customer lifecycle events using EventEmitter2
 */
@Injectable()
export class CustomerEventsService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Emit customer event
   */
  async emit(
    eventType: CustomerEventType,
    payload: CustomerEventPayload,
  ): Promise<void> {
    try {
      this.eventEmitter.emit(eventType, payload);

      this.logger.debug(
        createLogContext(this.contextService, "emit", {
          eventType,
          customerId: payload.customerId,
          storeId: payload.storeId,
        }),
        `Emitted customer event: ${eventType}`,
      );
    } catch (error) {
      // Don't throw - event emission failure shouldn't break the operation
      this.logger.warn(
        createErrorContext(this.contextService, "emit", error, {
          eventType,
          customerId: payload.customerId,
        }),
        `Failed to emit customer event ${eventType}`,
      );
    }
  }

  /**
   * Emit customer created event
   */
  async emitCustomerCreated(payload: CustomerEventPayload): Promise<void> {
    await this.emit(CustomerEventType.CUSTOMER_CREATED, payload);
  }

  /**
   * Emit customer updated event
   */
  async emitCustomerUpdated(payload: CustomerEventPayload): Promise<void> {
    await this.emit(CustomerEventType.CUSTOMER_UPDATED, payload);
  }

  /**
   * Emit customer deleted event
   */
  async emitCustomerDeleted(payload: CustomerEventPayload): Promise<void> {
    await this.emit(CustomerEventType.CUSTOMER_DELETED, payload);
  }
}
