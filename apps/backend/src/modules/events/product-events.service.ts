import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { ProductEventPayload, ProductEventType } from "./product-events.types";

/**
 * Product Events Service
 * Emits product lifecycle events using EventEmitter2
 */
@Injectable()
export class ProductEventsService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Emit product event
   */
  async emit(
    eventType: ProductEventType,
    payload: ProductEventPayload,
  ): Promise<void> {
    try {
      this.eventEmitter.emit(eventType, payload);

      this.logger.debug(
        createLogContext(this.contextService, "emit", {
          eventType,
          productId: payload.productId,
          storeId: payload.storeId,
        }),
        `Emitted product event: ${eventType}`,
      );
    } catch (error) {
      // Don't throw - event emission failure shouldn't break the operation
      this.logger.warn(
        createErrorContext(this.contextService, "emit", error, {
          eventType,
          productId: payload.productId,
        }),
        `Failed to emit product event ${eventType}`,
      );
    }
  }

  /**
   * Emit product created event
   */
  async emitProductCreated(payload: ProductEventPayload): Promise<void> {
    await this.emit(ProductEventType.PRODUCT_CREATED, payload);
  }

  /**
   * Emit product updated event
   */
  async emitProductUpdated(payload: ProductEventPayload): Promise<void> {
    await this.emit(ProductEventType.PRODUCT_UPDATED, payload);
  }

  /**
   * Emit product deleted event
   */
  async emitProductDeleted(payload: ProductEventPayload): Promise<void> {
    await this.emit(ProductEventType.PRODUCT_DELETED, payload);
  }

  /**
   * Emit product published event
   */
  async emitProductPublished(payload: ProductEventPayload): Promise<void> {
    await this.emit(ProductEventType.PRODUCT_PUBLISHED, payload);
  }

  /**
   * Emit product unpublished event
   */
  async emitProductUnpublished(payload: ProductEventPayload): Promise<void> {
    await this.emit(ProductEventType.PRODUCT_UNPUBLISHED, payload);
  }
}
