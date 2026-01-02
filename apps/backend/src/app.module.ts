import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AuditLogModule } from "./common/audit/audit-log.module";
import { ConfigModule } from "./common/config/config.module";
import { HealthController } from "./common/health/health.controller";
import { HealthDatabaseController } from "./common/health/health-database.controller";
import { HealthJobsController } from "./common/health/health-jobs.controller";
import { HealthLoggerController } from "./common/health/health-logger.controller";
import { HealthRedisController } from "./common/health/health-redis.controller";
import { HealthTracingController } from "./common/health/health-tracing.controller";
import { ContextModule } from "./common/logging/context.module";
import { LoggerModule } from "./common/logging/logger.module";
import { MetricsModule } from "./common/metrics/metrics.module";
import { RateLimitingModule } from "./common/rate-limiting/rate-limiting.module";
import { OtelTracingModule } from "./common/tracing/otel-tracing.module";
import { TracingModule } from "./common/tracing/tracing.module";
import { AddressAutocompleteModule } from "./modules/address-autocomplete/address-autocomplete.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AdminAuthModule } from "./modules/admin-auth/admin-auth.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BlogModule } from "./modules/blog/blog.module";
import { BundlesModule } from "./modules/bundles/bundles.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CheckoutModule } from "./modules/checkout/checkout.module";
import { CollectionsModule } from "./modules/collections/collections.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { DatabaseModule } from "./modules/database/database.module";
import { DiscountsModule } from "./modules/discounts/discounts.module";
import { EmailModule } from "./modules/email/email.module";
import { EventsModule } from "./modules/events/events.module";
import { ExportsModule } from "./modules/exports/exports.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentChargesModule } from "./modules/payment-charges/payment-charges.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { PricingModule } from "./modules/pricing/pricing.module";
import { ProductAssociationsModule } from "./modules/product-associations/product-associations.module";
import { ProductsModule } from "./modules/products/products.module";
import { RedisStoreModule } from "./modules/redis-store/redis-store.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { ShippingModule } from "./modules/shipping/shipping.module";
import { StorageModule } from "./modules/storage/storage.module";
import { StoresModule } from "./modules/stores/stores.module";
import { SystemLogsModule } from "./modules/system-logs/system-logs.module";
import { ThemeModule } from "./modules/theme/theme.module";

@Module({
  imports: [
    // Register configuration module first (global)
    ConfigModule,
    // Register logging and tracing modules first
    LoggerModule,
    ContextModule,
    // TracingModule always provides TracingService (handles disabled state internally)
    // Only OtelTracingModule is conditionally loaded
    TracingModule.forRoot(),
    ...(process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? [OtelTracingModule.forRoot()]
      : []),
    RateLimitingModule,
    // Prometheus metrics - only loaded if PROMETHEUS_ENABLED=true
    MetricsModule.forRoot(),
    AuditLogModule, // Audit logging
    // Register DatabaseModule early for connection management
    DatabaseModule,
    // Register StorageModule first so it's available to other modules
    StorageModule.forRootAsync(),
    AuthModule,
    CategoriesModule,
    CheckoutModule,
    CollectionsModule,
    ProductsModule,
    CustomersModule,
    OrdersModule,
    PaymentsModule,
    PaymentChargesModule,
    ShippingModule,
    AdminModule,
    AdminAuthModule,
    InvoicesModule,
    AddressAutocompleteModule,
    DiscountsModule,
    PricingModule,
    RedisStoreModule,
    InventoryModule,
    PermissionsModule,
    BundlesModule,
    ReviewsModule,
    NotificationsModule,
    BlogModule,
    StoresModule,
    ThemeModule,
    ExportsModule,
    SystemLogsModule,
    ProductAssociationsModule,
    EventsModule,
    EmailModule,
  ],
  controllers: [
    AppController,
    HealthController, // Comprehensive health check (should be first)
    HealthLoggerController,
    HealthTracingController,
    HealthDatabaseController,
    HealthRedisController,
    HealthJobsController,
  ],
})
export class AppModule {}
