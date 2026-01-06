import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { stores, webhooks } from "@vcecom/db";
import { and, eq, sql } from "drizzle-orm";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import type { Database } from "../../../modules/database/db";
import { DB_TOKEN } from "../../database/database.module";
import {
  CustomerEventPayload,
  CustomerEventType,
} from "../../events/customer-events.types";
import {
  OrderEventPayload,
  OrderEventType,
} from "../../events/order-events.types";
import {
  ProductEventPayload,
  ProductEventType,
} from "../../events/product-events.types";
import { WebhookDeliveryQueue } from "../queues/webhook-delivery.queue";

/**
 * Webhook Delivery Service
 * Listens to events and queues webhook deliveries
 */
@Injectable()
export class WebhookDeliveryService implements OnModuleInit {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly webhookQueue: WebhookDeliveryQueue,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    this.logger.info("WebhookDeliveryService initialized");
  }

  /**
   * Handle order events
   */
  @OnEvent(OrderEventType.ORDER_CREATED)
  async handleOrderCreated(payload: OrderEventPayload): Promise<void> {
    await this.deliverWebhooks(
      OrderEventType.ORDER_CREATED,
      "order",
      payload.orderId,
      payload,
    );
  }

  @OnEvent(OrderEventType.ORDER_CONFIRMED)
  async handleOrderConfirmed(payload: OrderEventPayload): Promise<void> {
    await this.deliverWebhooks(
      OrderEventType.ORDER_CONFIRMED,
      "order",
      payload.orderId,
      payload,
    );
  }

  @OnEvent(OrderEventType.ORDER_PROCESSING)
  async handleOrderProcessing(payload: OrderEventPayload): Promise<void> {
    await this.deliverWebhooks(
      OrderEventType.ORDER_PROCESSING,
      "order",
      payload.orderId,
      payload,
    );
  }

  @OnEvent(OrderEventType.ORDER_SHIPPED)
  async handleOrderShipped(payload: OrderEventPayload): Promise<void> {
    await this.deliverWebhooks(
      OrderEventType.ORDER_SHIPPED,
      "order",
      payload.orderId,
      payload,
    );
  }

  @OnEvent(OrderEventType.ORDER_DELIVERED)
  async handleOrderDelivered(payload: OrderEventPayload): Promise<void> {
    await this.deliverWebhooks(
      OrderEventType.ORDER_DELIVERED,
      "order",
      payload.orderId,
      payload,
    );
  }

  @OnEvent(OrderEventType.ORDER_CANCELLED)
  async handleOrderCancelled(payload: OrderEventPayload): Promise<void> {
    await this.deliverWebhooks(
      OrderEventType.ORDER_CANCELLED,
      "order",
      payload.orderId,
      payload,
    );
  }

  @OnEvent(OrderEventType.ORDER_PAYMENT_COMPLETED)
  async handleOrderPaymentCompleted(payload: OrderEventPayload): Promise<void> {
    await this.deliverWebhooks(
      OrderEventType.ORDER_PAYMENT_COMPLETED,
      "order",
      payload.orderId,
      payload,
    );
  }

  @OnEvent(OrderEventType.ORDER_PAYMENT_FAILED)
  async handleOrderPaymentFailed(payload: OrderEventPayload): Promise<void> {
    await this.deliverWebhooks(
      OrderEventType.ORDER_PAYMENT_FAILED,
      "order",
      payload.orderId,
      payload,
    );
  }

  @OnEvent(OrderEventType.ORDER_REFUND_INITIATED)
  async handleOrderRefundInitiated(payload: OrderEventPayload): Promise<void> {
    await this.deliverWebhooks(
      OrderEventType.ORDER_REFUND_INITIATED,
      "order",
      payload.orderId,
      payload,
    );
  }

  @OnEvent(OrderEventType.ORDER_REFUND_COMPLETED)
  async handleOrderRefundCompleted(payload: OrderEventPayload): Promise<void> {
    await this.deliverWebhooks(
      OrderEventType.ORDER_REFUND_COMPLETED,
      "order",
      payload.orderId,
      payload,
    );
  }

  /**
   * Handle product events
   */
  @OnEvent(ProductEventType.PRODUCT_CREATED)
  async handleProductCreated(payload: ProductEventPayload): Promise<void> {
    await this.deliverWebhooks(
      ProductEventType.PRODUCT_CREATED,
      "product",
      payload.productId,
      payload,
    );
  }

  @OnEvent(ProductEventType.PRODUCT_UPDATED)
  async handleProductUpdated(payload: ProductEventPayload): Promise<void> {
    await this.deliverWebhooks(
      ProductEventType.PRODUCT_UPDATED,
      "product",
      payload.productId,
      payload,
    );
  }

  @OnEvent(ProductEventType.PRODUCT_DELETED)
  async handleProductDeleted(payload: ProductEventPayload): Promise<void> {
    await this.deliverWebhooks(
      ProductEventType.PRODUCT_DELETED,
      "product",
      payload.productId,
      payload,
    );
  }

  @OnEvent(ProductEventType.PRODUCT_PUBLISHED)
  async handleProductPublished(payload: ProductEventPayload): Promise<void> {
    await this.deliverWebhooks(
      ProductEventType.PRODUCT_PUBLISHED,
      "product",
      payload.productId,
      payload,
    );
  }

  @OnEvent(ProductEventType.PRODUCT_UNPUBLISHED)
  async handleProductUnpublished(payload: ProductEventPayload): Promise<void> {
    await this.deliverWebhooks(
      ProductEventType.PRODUCT_UNPUBLISHED,
      "product",
      payload.productId,
      payload,
    );
  }

  /**
   * Handle customer events
   */
  @OnEvent(CustomerEventType.CUSTOMER_CREATED)
  async handleCustomerCreated(payload: CustomerEventPayload): Promise<void> {
    await this.deliverWebhooks(
      CustomerEventType.CUSTOMER_CREATED,
      "customer",
      payload.customerId,
      payload,
    );
  }

  @OnEvent(CustomerEventType.CUSTOMER_UPDATED)
  async handleCustomerUpdated(payload: CustomerEventPayload): Promise<void> {
    await this.deliverWebhooks(
      CustomerEventType.CUSTOMER_UPDATED,
      "customer",
      payload.customerId,
      payload,
    );
  }

  @OnEvent(CustomerEventType.CUSTOMER_DELETED)
  async handleCustomerDeleted(payload: CustomerEventPayload): Promise<void> {
    await this.deliverWebhooks(
      CustomerEventType.CUSTOMER_DELETED,
      "customer",
      payload.customerId,
      payload,
    );
  }

  /**
   * Deliver webhooks for an event
   */
  private async deliverWebhooks(
    eventType: string,
    eventCategory: "order" | "product" | "customer",
    eventId: string,
    payload: OrderEventPayload | ProductEventPayload | CustomerEventPayload,
  ): Promise<void> {
    try {
      // Fetch storeId from database based on event category
      // For now, get the default store (single-tenant assumption)
      // TODO: Update when multi-tenant storeId fields are added to orders/products/customers
      let storeId: string | null = null;

      // Get default store
      const [defaultStore] = await this.db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.isDefault, true))
        .limit(1);

      storeId = defaultStore?.id || null;

      if (!storeId) {
        // If no default store, get the first store
        const [firstStore] = await this.db
          .select({ id: stores.id })
          .from(stores)
          .limit(1);
        storeId = firstStore?.id || null;
      }

      if (!storeId) {
        this.logger.warn(
          createLogContext(this.contextService, "deliverWebhooks", {
            eventType,
            eventCategory,
            eventId,
          }),
          `Could not find store for event`,
        );
        return;
      }

      // Find active webhooks for this event type and store
      // Use SQL to check if events array contains the event type
      const activeWebhooks = await this.db
        .select()
        .from(webhooks)
        .where(
          and(
            eq(webhooks.isActive, true),
            eq(webhooks.storeId, storeId),
            sql`${webhooks.events} @> ${sql.raw(`'["${eventType}"]'`)}::jsonb`,
          ),
        );

      // Queue webhook deliveries
      for (const webhook of activeWebhooks) {
        try {
          await this.webhookQueue.addJob({
            webhookId: webhook.id,
            eventType,
            eventId,
            payload: payload as unknown as Record<string, unknown>,
            url: webhook.url,
            secret: webhook.secret,
            headers: webhook.headers || {},
            timeoutMs: webhook.timeoutMs,
          });

          this.logger.debug(
            createLogContext(this.contextService, "deliverWebhooks", {
              webhookId: webhook.id,
              eventType,
              eventId,
            }),
            `Queued webhook delivery`,
          );
        } catch (error) {
          this.logger.warn(
            createErrorContext(this.contextService, "deliverWebhooks", error, {
              webhookId: webhook.id,
              eventType,
              eventId,
            }),
            `Failed to queue webhook delivery`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "deliverWebhooks", error, {
          eventType,
          eventCategory,
          eventId,
        }),
        `Failed to deliver webhooks for event`,
      );
    }
  }
}
