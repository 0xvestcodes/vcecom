import { forwardRef, Module } from "@nestjs/common";
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
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { ReconciliationService } from "./reconciliation.service";
import { OrderAddressService } from "./services/order-address.service";
import { OrderArchiveService } from "./services/order-archive.service";
import { OrderCancelService } from "./services/order-cancel.service";
import { OrderCreationService } from "./services/order-creation.service";
import { OrderDiscountService } from "./services/order-discount.service";
import { OrderDuplicateService } from "./services/order-duplicate.service";
import { OrderEnrichmentService } from "./services/order-enrichment.service";
import { OrderGstService } from "./services/order-gst.service";
import { OrderInventoryService } from "./services/order-inventory.service";
import { OrderNotesService } from "./services/order-notes.service";
import { OrderPaymentService } from "./services/order-payment.service";
import { OrderPricingService } from "./services/order-pricing.service";
import { OrderQueryService } from "./services/order-query.service";
import { OrderStatusService } from "./services/order-status.service";
import { OrderTimelineService } from "./services/order-timeline.service";
import { OrderTrackingService } from "./services/order-tracking.service";
import { OrderValidationService } from "./services/order-validation.service";
import { RefundsService } from "./services/refunds.service";

@Module({
  imports: [
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
    OrderPricingService,
    OrderStatusService,
    OrderGstService,
    OrderInventoryService,
    OrderDiscountService,
    OrderEnrichmentService,
    OrderQueryService,
    OrderCreationService,
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
  exports: [
    OrdersService,
    ReconciliationService,
    OrderValidationService,
    OrderPricingService,
    OrderStatusService,
    OrderGstService,
    OrderInventoryService,
    OrderDiscountService,
    OrderEnrichmentService,
    OrderQueryService,
    OrderCreationService,
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
