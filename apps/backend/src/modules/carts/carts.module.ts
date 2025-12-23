import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { BundlesModule } from "../bundles/bundles.module";
import { DiscountsModule } from "../discounts/discounts.module";
import { PricingModule } from "../pricing/pricing.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { CartsController } from "./carts.controller";
import { CartsService } from "./carts.service";
import { CartCleanupService } from "./services/cart-cleanup.service";

@Module({
  imports: [
    DiscountsModule,
    RedisStoreModule,
    BundlesModule,
    PricingModule,
    ScheduleModule,
  ],
  controllers: [CartsController],
  providers: [CartsService, CartCleanupService],
  exports: [CartsService],
})
export class CartsModule {}
