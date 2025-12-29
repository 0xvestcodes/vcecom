import { forwardRef, Module } from "@nestjs/common";
import { AuditLogModule } from "../../common/audit/audit-log.module";
import { MetricsModule } from "../../common/metrics/metrics.module";
import { BundlesModule } from "../bundles/bundles.module";
import { CartsModule } from "../carts/carts.module";
import { CustomersModule } from "../customers/customers.module";
import { DiscountsModule } from "../discounts/discounts.module";
import { EventsModule } from "../events/events.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { PricingModule } from "../pricing/pricing.module";
import { ProductsModule } from "../products/products.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { InventoryReconciliationJob } from "./jobs/inventory-reconciliation.job";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { ReconciliationService } from "./reconciliation.service";
import { OrderCalculationService } from "./services/calculation/order-calculation.service";
import { OrderTotalsCalculationService } from "./services/calculation/order-totals-calculation.service";
import { OrderCartCleanupService } from "./services/cart/order-cart-cleanup.service";
import { OrderCartDataService } from "./services/cart/order-cart-data.service";
import { OrderCartProcessingService } from "./services/cart/order-cart-processing.service";
import { OrderCartValidationService } from "./services/cart/order-cart-validation.service";
import { OrderCheckoutOrchestrationService } from "./services/checkout/order-checkout-orchestration.service";
import { OrderCheckoutSessionService } from "./services/checkout/order-checkout-session.service";
import { OrderMetadataService } from "./services/checkout/order-metadata.service";
import { OrderStateTransitionService } from "./services/checkout/order-state-transition.service";
import { OrderCodFlowService } from "./services/creation/order-cod-flow.service";
import { OrderCreationService } from "./services/creation/order-creation.service";
import { OrderPaymentFinalizationService } from "./services/creation/order-payment-finalization.service";
import { OrderPaymentIntentFlowService } from "./services/creation/order-payment-intent-flow.service";
import { OrderDiscountService } from "./services/discount/order-discount.service";
import { OrderDiscountEngineService } from "./services/discount/order-discount-engine.service";
import { OrderDiscountExtractionService } from "./services/discount/order-discount-extraction.service";
import { OrderDiscountUsageService } from "./services/discount/order-discount-usage.service";
import { OrderEventOrchestrationService } from "./services/events/order-event-orchestration.service";
import { OrderGstService } from "./services/gst/order-gst.service";
import { OrderIdempotencyService } from "./services/idempotency/order-idempotency.service";
import { OrderInventoryService } from "./services/inventory/order-inventory.service";
import { OrderInventoryMetricsService } from "./services/inventory/order-inventory-metrics.service";
import { OrderNotificationService } from "./services/notifications/order-notification.service";
import { OrderAddressService } from "./services/operations/order-address.service";
import { OrderArchiveService } from "./services/operations/order-archive.service";
import { OrderCancelService } from "./services/operations/order-cancel.service";
import { OrderDuplicateService } from "./services/operations/order-duplicate.service";
import { OrderNotesService } from "./services/operations/order-notes.service";
import { OrderPaymentService } from "./services/payment/order-payment.service";
import { OrderPaymentIntentService } from "./services/payment/order-payment-intent.service";
import { RefundsService } from "./services/payment/refunds.service";
import { OrderPersistenceService } from "./services/persistence/order-persistence.service";
import { OrderPricingService } from "./services/pricing/order-pricing.service";
import { OrderPricingDriftService } from "./services/pricing/order-pricing-drift.service";
import { OrderPricingEngineService } from "./services/pricing/order-pricing-engine.service";
import { OrderEnrichmentService } from "./services/query/order-enrichment.service";
import { OrderQueryService } from "./services/query/order-query.service";
import { OrderQueryRepositoryService } from "./services/query/order-query-repository.service";
import { OrderResponseBuilderService } from "./services/query/order-response-builder.service";
import { OrderPricingSnapshotService } from "./services/snapshot/order-pricing-snapshot.service";
import { OrderSnapshotAuditService } from "./services/snapshot/order-snapshot-audit.service";
import { OrderSnapshotValidationService } from "./services/snapshot/order-snapshot-validation.service";
import { OrderStatusService } from "./services/status/order-status.service";
import { OrderTimelineService } from "./services/status/order-timeline.service";
import { OrderTrackingService } from "./services/status/order-tracking.service";
import { OrderValidationService } from "./services/validation/order-validation.service";

@Module({
  imports: [
    MetricsModule,
    AuditLogModule,
    CartsModule,
    BundlesModule,
    DiscountsModule,
    PricingModule,
    ProductsModule,
    RedisStoreModule,
    CustomersModule,
    NotificationsModule,
    EventsModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    ReconciliationService,
    OrderValidationService,
    OrderCartValidationService,
    OrderPricingService,
    OrderStatusService,
    OrderGstService,
    OrderInventoryService,
    OrderInventoryMetricsService,
    OrderDiscountService,
    OrderEnrichmentService,
    OrderQueryService,
    OrderQueryRepositoryService,
    OrderCreationService,
    OrderCodFlowService,
    OrderPaymentFinalizationService,
    OrderPaymentIntentFlowService,
    OrderCheckoutSessionService,
    OrderPaymentIntentService,
    OrderPersistenceService,
    OrderCartProcessingService,
    OrderCalculationService,
    OrderTotalsCalculationService,
    OrderPricingEngineService,
    OrderDiscountEngineService,
    OrderNotificationService,
    OrderStateTransitionService,
    OrderEventOrchestrationService,
    OrderMetadataService,
    OrderResponseBuilderService,
    OrderDiscountUsageService,
    OrderPricingSnapshotService,
    OrderCartCleanupService,
    OrderCheckoutOrchestrationService,
    OrderSnapshotAuditService,
    OrderCartDataService,
    OrderCartValidationService,
    OrderSnapshotValidationService,
    OrderPricingDriftService,
    OrderDiscountExtractionService,
    OrderIdempotencyService,
    OrderTimelineService,
    OrderTrackingService,
    OrderNotesService,
    RefundsService,
    OrderPaymentService,
    OrderAddressService,
    OrderCancelService,
    OrderArchiveService,
    OrderDuplicateService,
    InventoryReconciliationJob,
  ],
  exports: [
    OrdersService,
    ReconciliationService,
    OrderValidationService,
    OrderCartValidationService,
    OrderPricingService,
    OrderStatusService,
    OrderGstService,
    OrderInventoryService,
    OrderDiscountService,
    OrderEnrichmentService,
    OrderQueryService,
    OrderQueryRepositoryService,
    OrderCreationService,
    OrderCodFlowService,
    OrderPaymentFinalizationService,
    OrderPaymentIntentFlowService,
    OrderCheckoutSessionService,
    OrderPaymentIntentService,
    OrderPersistenceService,
    OrderCartProcessingService,
    OrderCalculationService,
    OrderTotalsCalculationService,
    OrderPricingEngineService,
    OrderDiscountEngineService,
    OrderNotificationService,
    OrderStateTransitionService,
    OrderEventOrchestrationService,
    OrderMetadataService,
    OrderResponseBuilderService,
    OrderDiscountUsageService,
    OrderPricingSnapshotService,
    OrderCartCleanupService,
    OrderCheckoutOrchestrationService,
    OrderSnapshotAuditService,
    OrderCartDataService,
    OrderCartValidationService,
    OrderSnapshotValidationService,
    OrderPricingDriftService,
    OrderDiscountExtractionService,
    OrderIdempotencyService,
    OrderTimelineService,
    OrderTrackingService,
    OrderNotesService,
    RefundsService,
    OrderPaymentService,
    OrderAddressService,
    OrderCancelService,
    OrderArchiveService,
    OrderDuplicateService,
  ],
})
export class OrdersModule {}
