import { forwardRef, Module } from "@nestjs/common";
import { ContextModule } from "../../common/logging/context.module";
import { LoggerModule } from "../../common/logging/logger.module";
import { ProductsModule } from "../products/products.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { BundlesController } from "./bundles.controller";
import { BundleCacheHydrationService } from "./services/bundle-cache-hydration.service";
import { BundleDefinitionService } from "./services/bundle-definition.service";
import { BundleEligibilityService } from "./services/bundle-eligibility.service";
import { BundleSetItemsService } from "./services/bundle-set-items.service";
import { BundleSetsService } from "./services/bundle-sets.service";
import { BundleWarmupService } from "./services/bundle-warmup.service";
import { StorefrontBundlesController } from "./storefront-bundles.controller";

@Module({
  imports: [
    RedisStoreModule,
    LoggerModule,
    ContextModule,
    forwardRef(() => ProductsModule),
  ],
  controllers: [BundlesController, StorefrontBundlesController],
  providers: [
    BundleDefinitionService,
    BundleSetsService,
    BundleSetItemsService,
    BundleEligibilityService,
    BundleWarmupService,
    BundleCacheHydrationService,
  ],
  exports: [BundleDefinitionService, BundleEligibilityService],
})
export class BundlesModule {}
