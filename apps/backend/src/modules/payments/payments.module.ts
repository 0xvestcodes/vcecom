import { forwardRef, Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { AdminPaymentsController } from "./admin-payments.controller";
import { CashfreeConfigService } from "./cashfree-config.service";
import { PaymentsService } from "./payments.service";
import { PayUConfigService } from "./payu-config.service";
import { RazorpayConfigService } from "./razorpay-config.service";
import { PaymentChargeService } from "./services/payment-charge.service";
import { PaymentFeeAuditService } from "./services/payment-fee-audit.service";
import { StorePaymentsController } from "./store-payments.controller";

@Module({
  imports: [RedisStoreModule, forwardRef(() => OrdersModule)],
  controllers: [AdminPaymentsController, StorePaymentsController],
  providers: [
    PaymentsService,
    RazorpayConfigService,
    CashfreeConfigService,
    PayUConfigService,
    PaymentChargeService,
    PaymentFeeAuditService,
  ],
  exports: [
    PaymentsService,
    RazorpayConfigService,
    CashfreeConfigService,
    PayUConfigService,
    PaymentChargeService,
    PaymentFeeAuditService,
  ],
})
export class PaymentsModule {}
