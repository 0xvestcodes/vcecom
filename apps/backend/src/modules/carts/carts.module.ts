import { forwardRef, Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { BundlesModule } from "../bundles/bundles.module";
import { DiscountsModule } from "../discounts/discounts.module";
import { EmailModule } from "../email/email.module";
import { PricingModule } from "../pricing/pricing.module";
import { ProductsModule } from "../products/products.module";
import { QueueModule } from "../queue/queue.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { SMSModule } from "../sms/sms.module";
import { CartsController } from "./carts.controller";
import { CartsService } from "./carts.service";
import { AbandonedCartDetectionService } from "./services/abandoned-cart-detection.service";
import { AbandonedCartRecoveryService } from "./services/abandoned-cart-recovery.service";
import { CartActivityService } from "./services/cart-activity.service";
import { CartCleanupService } from "./services/cart-cleanup.service";

@Module({
  imports: [
    DiscountsModule,
    RedisStoreModule,
    BundlesModule,
    PricingModule,
    ProductsModule,
    ScheduleModule,
    EmailModule,
    SMSModule,
    forwardRef(() => QueueModule),
  ],
  controllers: [CartsController],
  providers: [
    CartsService,
    CartCleanupService,
    CartActivityService,
    AbandonedCartDetectionService,
    AbandonedCartRecoveryService,
  ],
  exports: [CartsService, CartActivityService, AbandonedCartRecoveryService],
})
export class CartsModule {}
