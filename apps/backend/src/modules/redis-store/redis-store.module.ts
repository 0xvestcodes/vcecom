import { forwardRef, Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { TracingModule } from "../../common/tracing/tracing.module";
import { DatabaseModule } from "../database/database.module";
import { RedisStoreService } from "./redis-store.service";
import { InventoryRecoveryService } from "./services/inventory-recovery.service";
import { ReservationCleanupService } from "./services/reservation-cleanup.service";
import { BundleCacheStore } from "./stores/bundle-cache-store";
import { CartStore } from "./stores/cart-store";
import { CheckoutLockStore } from "./stores/checkout-lock-store";
import { CheckoutStore } from "./stores/checkout-store";
import { DiscountRuleStore } from "./stores/discount-rule-store";
import { EligibilityStore } from "./stores/eligibility-store";
import { FingerprintStore } from "./stores/fingerprint-store";
import { HeartbeatStore } from "./stores/heartbeat-store";
import { IdempotencyStore } from "./stores/idempotency-store";
import { InventoryStore } from "./stores/inventory-store";
import { ProductMappingStore } from "./stores/product-mapping-store";
import { StaleMarkerStore } from "./stores/stale-marker-store";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    forwardRef(() => DatabaseModule), // Use forwardRef to break circular dependency
    forwardRef(() => TracingModule.forRoot()), // Use forwardRef to break circular dependency with LoggerModule
  ],
  providers: [
    RedisStoreService,
    InventoryStore,
    CartStore,
    CheckoutStore,
    CheckoutLockStore,
    HeartbeatStore,
    FingerprintStore,
    IdempotencyStore,
    InventoryRecoveryService,
    ReservationCleanupService,
    DiscountRuleStore,
    EligibilityStore,
    ProductMappingStore,
    BundleCacheStore,
    StaleMarkerStore,
  ],
  exports: [
    RedisStoreService,
    InventoryStore,
    CartStore,
    CheckoutStore,
    CheckoutLockStore,
    HeartbeatStore,
    FingerprintStore,
    IdempotencyStore,
    InventoryRecoveryService,
    ReservationCleanupService,
    DiscountRuleStore,
    EligibilityStore,
    ProductMappingStore,
    BundleCacheStore,
    StaleMarkerStore,
  ],
})
export class RedisStoreModule {}
