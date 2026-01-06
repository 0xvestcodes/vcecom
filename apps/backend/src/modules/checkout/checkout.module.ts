import { forwardRef, Module } from "@nestjs/common";
import { CartsModule } from "../carts/carts.module";
import { CustomersModule } from "../customers/customers.module";
import { OrdersModule } from "../orders/orders.module";
import { PaymentsModule } from "../payments/payments.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { ShippingModule } from "../shipping/shipping.module";
import { StoresModule } from "../stores/stores.module";
import { WalletModule } from "../wallet/wallet.module";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";

@Module({
  imports: [
    CartsModule,
    PaymentsModule,
    RedisStoreModule,
    ShippingModule,
    CustomersModule,
    StoresModule,
    WalletModule,
    forwardRef(() => OrdersModule),
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
