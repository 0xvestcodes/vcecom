import { Module } from "@nestjs/common";
import { CartsModule } from "../carts/carts.module";
import { DiscountsModule } from "../discounts/discounts.module";
import { AdminOrdersController } from "../orders/admin-orders.controller";
import { OrdersModule } from "../orders/orders.module";
import { PricingModule } from "../pricing/pricing.module";
import { ProductsModule } from "../products/products.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminActivityLogsController } from "./admin-activity-logs.controller";
import { AdminActivityLogsService } from "./admin-activity-logs.service";
import { AdminDashboardsController } from "./admin-dashboards.controller";
import { AdminJobsController } from "./admin-jobs.controller";
import { AdminRedisController } from "./admin-redis.controller";
import { BackgroundJobsService } from "./services/background-jobs.service";
import { DashboardService } from "./services/dashboard.service";
import { RedisHealthService } from "./services/redis-health.service";

@Module({
  imports: [
    ProductsModule,
    CartsModule,
    RedisStoreModule,
    OrdersModule,
    DiscountsModule,
    PricingModule,
  ],
  controllers: [
    AdminController,
    AdminActivityLogsController,
    AdminRedisController,
    AdminJobsController,
    AdminOrdersController,
    AdminDashboardsController,
  ],
  providers: [
    AdminService,
    AdminActivityLogsService,
    RedisHealthService,
    BackgroundJobsService,
    DashboardService,
  ],
  exports: [AdminService, RedisHealthService, BackgroundJobsService],
})
export class AdminModule {}
