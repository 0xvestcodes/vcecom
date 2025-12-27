import { forwardRef, Module } from "@nestjs/common";
import { BundlesModule } from "../bundles/bundles.module";
import { CartsModule } from "../carts/carts.module";
import { CustomersModule } from "../customers/customers.module";
import { DiscountsModule } from "../discounts/discounts.module";
import { EventsModule } from "../events/events.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { PricingModule } from "../pricing/pricing.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { ReconciliationService } from "./reconciliation.service";
import { OrderAddressService } from "./services/order-address.service";
import { OrderArchiveService } from "./services/order-archive.service";
import { OrderCancelService } from "./services/order-cancel.service";
import { OrderDuplicateService } from "./services/order-duplicate.service";
import { OrderGstService } from "./services/order-gst.service";
import { OrderNotesService } from "./services/order-notes.service";
import { OrderPaymentService } from "./services/order-payment.service";
import { OrderPricingService } from "./services/order-pricing.service";
import { OrderStatusService } from "./services/order-status.service";
import { OrderTimelineService } from "./services/order-timeline.service";
import { OrderValidationService } from "./services/order-validation.service";
import { RefundsService } from "./services/refunds.service";

@Module({
  imports: [
    CartsModule,
    BundlesModule,
    DiscountsModule,
    PricingModule,
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
    OrderTimelineService,
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
    OrderTimelineService,
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
