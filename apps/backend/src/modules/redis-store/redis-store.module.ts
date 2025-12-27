import { forwardRef, Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "../database/database.module";
import { RedisStoreService } from "./redis-store.service";
import { InventoryRecoveryService } from "./services/inventory-recovery.service";
import { BundleCacheStore } from "./stores/bundle-cache-store";
import { CartStore } from "./stores/cart-store";
import { CheckoutStore } from "./stores/checkout-store";
import { DiscountRuleStore } from "./stores/discount-rule-store";
import { EligibilityStore } from "./stores/eligibility-store";
import { IdempotencyStore } from "./stores/idempotency-store";
import { InventoryStore } from "./stores/inventory-store";
import { ProductMappingStore } from "./stores/product-mapping-store";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    forwardRef(() => DatabaseModule), // Use forwardRef to break circular dependency
  ],
  providers: [
    RedisStoreService,
    InventoryStore,
    CartStore,
    CheckoutStore,
    IdempotencyStore,
    InventoryRecoveryService,
    DiscountRuleStore,
    EligibilityStore,
    ProductMappingStore,
    BundleCacheStore,
  ],
  exports: [
    RedisStoreService,
    InventoryStore,
    CartStore,
    CheckoutStore,
    IdempotencyStore,
    InventoryRecoveryService,
    DiscountRuleStore,
    EligibilityStore,
    ProductMappingStore,
    BundleCacheStore,
  ],
})
export class RedisStoreModule {}
