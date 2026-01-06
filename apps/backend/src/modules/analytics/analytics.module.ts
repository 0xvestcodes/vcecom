import { forwardRef, Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { QueueModule } from "../queue/queue.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { AnalyticsWarmupProcessor } from "./processors/analytics-warmup.processor";
import { AnalyticsWarmupScheduler } from "./schedulers/analytics-warmup.scheduler";
import { CachedMetricsService } from "./services/cached-metrics.service";
import { CustomerSegmentationService } from "./services/customer-segmentation.service";
import { OrderAnalyticsService } from "./services/order-analytics.service";
import { ProductPerformanceService } from "./services/product-performance.service";
import { SalesAnalyticsService } from "./services/sales-analytics.service";
import { AnalyticsWarmupWorker } from "./workers/analytics-warmup-worker.service";

@Module({
  imports: [DatabaseModule, RedisStoreModule, forwardRef(() => QueueModule)],
  providers: [
    CachedMetricsService,
    OrderAnalyticsService,
    SalesAnalyticsService,
    CustomerSegmentationService,
    ProductPerformanceService,
    AnalyticsWarmupScheduler,
    AnalyticsWarmupWorker,
    AnalyticsWarmupProcessor,
  ],
  exports: [
    CachedMetricsService,
    OrderAnalyticsService,
    SalesAnalyticsService,
    CustomerSegmentationService,
    ProductPerformanceService,
  ],
})
export class AnalyticsModule {}
