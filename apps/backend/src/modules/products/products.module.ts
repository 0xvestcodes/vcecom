import { forwardRef, Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { NotificationsModule } from "../notifications/notifications.module";
import { PricingModule } from "../pricing/pricing.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { StorageModule } from "../storage/storage.module";
import { AdminProductsController } from "./admin-products.controller";
import { MediaHealthController } from "./controllers/media-health.controller";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { MediaAuditService } from "./services/media-audit.service";
import { MediaCacheInvalidationService } from "./services/media-cache-invalidation.service";
import { MediaConsistencyService } from "./services/media-consistency.service";
import { MediaConsistencyWorker } from "./services/media-consistency-worker.service";
import { MediaTransactionService } from "./services/media-transaction.service";
import { ProductEnrichmentService } from "./services/product-enrichment.service";
import { StorefrontSearchController } from "./storefront-search.controller";
import { VariantsController } from "./variants.controller";
import { VariantsService } from "./variants.service";

@Module({
  imports: [
    StorageModule,
    ScheduleModule,
    RedisStoreModule,
    NotificationsModule,
    PricingModule,
    forwardRef(() => ReviewsModule),
  ],
  controllers: [
    ProductsController,
    VariantsController,
    MediaHealthController,
    StorefrontSearchController,
    AdminProductsController,
  ],
  providers: [
    ProductsService,
    VariantsService,
    ProductEnrichmentService,
    MediaAuditService,
    MediaConsistencyService,
    MediaConsistencyWorker,
    MediaTransactionService,
    MediaCacheInvalidationService,
  ],
  exports: [
    ProductsService,
    VariantsService,
    ProductEnrichmentService,
    MediaConsistencyService,
    MediaAuditService,
    MediaConsistencyWorker,
  ],
})
export class ProductsModule {}
