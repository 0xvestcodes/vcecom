import { BullModule } from "@nestjs/bullmq";
import { forwardRef, Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AnalyticsModule } from "../analytics/analytics.module";
import { CartsModule } from "../carts/carts.module";
import { DiscountsModule } from "../discounts/discounts.module";
import { ImportsModule } from "../imports/imports.module";
import { PricingModule } from "../pricing/pricing.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { RedisStoreService } from "../redis-store/redis-store.service";
import { DeadLetterQueueService } from "./dead-letter-queue.service";
import { AbandonedCartRecoveryProcessor } from "./processors/abandoned-cart-recovery.processor";
import { DiscountWarmupProcessor } from "./processors/discount-warmup.processor";
import { ImportJobProcessor } from "./processors/import-job.processor";
import { PricingWarmupProcessor } from "./processors/pricing-warmup.processor";
import { QueueService } from "./queue.service";
import { RetryStrategyService } from "./retry-strategy.service";
import { ScheduledJobsService } from "./scheduled-jobs.service";
import { DiscountWarmupScheduler } from "./schedulers/discount-warmup.scheduler";
import { PricingWarmupScheduler } from "./schedulers/pricing-warmup.scheduler";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    RedisStoreModule,
    PricingModule,
    DiscountsModule,
    forwardRef(() => CartsModule),
    forwardRef(() => AnalyticsModule),
    forwardRef(() => ImportsModule),
    // Register queues with BullMQ
    BullModule.forRootAsync({
      imports: [RedisStoreModule],
      useFactory: async (redisStoreService: RedisStoreService) => {
        const redisClient = await redisStoreService.getClient();
        // BullMQ requires maxRetriesPerRequest to be null for blocking operations
        // Clone the client options and set maxRetriesPerRequest to null
        const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
        const BullMQRedis = (await import("ioredis")).default;
        const bullMQClient = new BullMQRedis(redisUrl, {
          ...redisClient.options,
          maxRetriesPerRequest: null, // Required by BullMQ
        });
        return {
          connection: bullMQClient,
        };
      },
      inject: [RedisStoreService],
    }),
    // Register individual queues
    BullModule.registerQueue(
      { name: "pricing-warmup" },
      { name: "discount-warmup" },
      { name: "analytics-warmup" },
      { name: "dead-letter" },
      { name: "abandoned-cart-recovery" },
      { name: "imports" },
    ),
  ],
  providers: [
    QueueService,
    DeadLetterQueueService,
    RetryStrategyService,
    ScheduledJobsService,
    PricingWarmupProcessor,
    DiscountWarmupProcessor,
    AbandonedCartRecoveryProcessor,
    ImportJobProcessor,
    PricingWarmupScheduler,
    DiscountWarmupScheduler,
  ],
  exports: [
    QueueService,
    DeadLetterQueueService,
    RetryStrategyService,
    ScheduledJobsService,
  ],
})
export class QueueModule {}
