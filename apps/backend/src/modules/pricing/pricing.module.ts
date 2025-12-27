import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { BundlesModule } from "../bundles/bundles.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { CustomerGroupsController } from "./customer-groups.controller";
import { PriceListsController } from "./price-lists.controller";
import { AdminPricingDriftReportService } from "./services/admin-pricing-drift-report.service";
import { BundlePricingService } from "./services/bundle-pricing.service";
import { CustomerGroupService } from "./services/customer-group.service";
import { PriceListService } from "./services/price-list.service";
import { PriceListChangeTracker } from "./services/price-list-change-tracker.service";
import { PricingAuditService } from "./services/pricing-audit.service";
import { PricingBundleService } from "./services/pricing-bundle.service";
import { PricingCacheHydrationService } from "./services/pricing-cache-hydration.service";
import { PricingDriftDetectorService } from "./services/pricing-drift-detector.service";
import { PricingHotReloadWatcher } from "./services/pricing-hot-reload-watcher.service";
import { PricingRebuilder } from "./services/pricing-rebuilder.service";
import { PricingSnapshotValidator } from "./services/pricing-snapshot-validator.service";
import { PricingVersionManager } from "./services/pricing-version-manager.service";
import { PricingWarmupWorker } from "./services/pricing-warmup-worker.service";
import { VariantPricingService } from "./services/variant-pricing.service";
import { StorefrontPriceListsController } from "./storefront-price-lists.controller";

@Module({
  imports: [RedisStoreModule, ScheduleModule, BundlesModule],
  controllers: [
    PriceListsController,
    CustomerGroupsController,
    StorefrontPriceListsController,
  ],
  providers: [
    PriceListService,
    VariantPricingService,
    CustomerGroupService,
    PricingVersionManager,
    PricingBundleService,
    BundlePricingService,
    PricingHotReloadWatcher,
    PricingRebuilder,
    PricingCacheHydrationService,
    PricingWarmupWorker,
    PricingAuditService,
    PricingDriftDetectorService,
    PriceListChangeTracker,
    AdminPricingDriftReportService,
    PricingSnapshotValidator,
  ],
  exports: [
    PriceListService,
    VariantPricingService,
    CustomerGroupService,
    BundlePricingService,
    PricingHotReloadWatcher,
    PricingRebuilder,
    PricingWarmupWorker,
    PricingSnapshotValidator,
    PricingAuditService,
    PricingDriftDetectorService,
  ],
})
export class PricingModule {}
