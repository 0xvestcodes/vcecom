import { forwardRef, Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { CartsModule } from "../carts/carts.module";
import { DatabaseModule } from "../database/database.module";
import { DiscountsModule } from "../discounts/discounts.module";
import { FraudDetectionModule } from "../fraud-detection/fraud-detection.module";
import { AdminOrdersController } from "../orders/admin-orders.controller";
import { OrdersModule } from "../orders/orders.module";
import { PricingModule } from "../pricing/pricing.module";
import { ProductsModule } from "../products/products.module";
import { QueueModule } from "../queue/queue.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminActivityLogsController } from "./admin-activity-logs.controller";
import { AdminActivityLogsService } from "./admin-activity-logs.service";
import { AdminBackupController } from "./admin-backup.controller";
import { AdminDashboardsController } from "./admin-dashboards.controller";
import { AdminJobsController } from "./admin-jobs.controller";
import { AdminRedisController } from "./admin-redis.controller";
import { BackgroundJobsService } from "./services/background-jobs.service";
import { DashboardService } from "./services/dashboard.service";
import { QueueMonitoringService } from "./services/queue-monitoring.service";
import { RedisHealthService } from "./services/redis-health.service";

@Module({
  imports: [
    ProductsModule,
    CartsModule,
    RedisStoreModule,
    OrdersModule,
    DiscountsModule,
    PricingModule,
    DatabaseModule, // Import DatabaseModule to access DatabaseBackupService
    forwardRef(() => QueueModule), // Import QueueModule for queue monitoring
    FraudDetectionModule,
    forwardRef(() => AnalyticsModule), // Import AnalyticsModule for analytics services
  ],
  controllers: [
    AdminController,
    AdminActivityLogsController,
    AdminRedisController,
    AdminJobsController,
    AdminOrdersController,
    AdminDashboardsController,
    AdminBackupController,
  ],
  providers: [
    AdminService,
    AdminActivityLogsService,
    RedisHealthService,
    BackgroundJobsService,
    DashboardService,
    QueueMonitoringService,
  ],
  exports: [AdminService, RedisHealthService, BackgroundJobsService],
})
export class AdminModule {}
