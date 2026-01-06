import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ContextModule } from "../../common/logging/context.module";
import { LoggerModule } from "../../common/logging/logger.module";
import { DatabaseModule } from "../database/database.module";
import { EventsModule } from "../events/events.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { RedisStoreService } from "../redis-store/redis-store.service";
import { AdminWebhooksController } from "./admin-webhooks.controller";
import { IncomingWebhooksController } from "./incoming-webhooks.controller";
import { WebhookDeliveryProcessor } from "./processors/webhook-delivery.processor";
import {
  WEBHOOK_DELIVERY_QUEUE_NAME,
  WebhookDeliveryQueue,
} from "./queues/webhook-delivery.queue";
import { AdminWebhooksService } from "./services/admin-webhooks.service";
import { WebhookDeliveryService } from "./services/webhook-delivery.service";
import { WebhookSigningService } from "./services/webhook-signing.service";

@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    LoggerModule,
    ContextModule,
    RedisStoreModule,
    BullModule.forRootAsync({
      imports: [RedisStoreModule],
      useFactory: async (redisStoreService: RedisStoreService) => {
        const redisClient = await redisStoreService.getClient();
        return {
          connection: redisClient,
        };
      },
      inject: [RedisStoreService],
    }),
    BullModule.registerQueue({
      name: WEBHOOK_DELIVERY_QUEUE_NAME,
    }),
  ],
  providers: [
    WebhookSigningService,
    WebhookDeliveryService,
    AdminWebhooksService,
    WebhookDeliveryQueue,
    WebhookDeliveryProcessor,
  ],
  controllers: [IncomingWebhooksController, AdminWebhooksController],
  exports: [
    WebhookSigningService,
    WebhookDeliveryService,
    WebhookDeliveryQueue,
  ],
})
export class WebhooksModule {}
