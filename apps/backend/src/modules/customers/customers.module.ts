import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { getValidatedJwtSecret } from "../../common/config/jwt-secret.validation";
import { EventsModule } from "../events/events.module";
import { OrdersModule } from "../orders/orders.module";
import { AddressesController } from "./addresses.controller";
import { AddressesService } from "./addresses.service";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { GstinVerificationService } from "./gstin-verification.service";
import { CustomerSessionService } from "./services/customer-session.service";

@Module({
  imports: [
    JwtModule.register({
      secret: getValidatedJwtSecret(),
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      },
    }),
    EventsModule,
    forwardRef(() => OrdersModule),
  ],
  controllers: [CustomersController, AddressesController],
  providers: [
    CustomersService,
    AddressesService,
    GstinVerificationService,
    CustomerSessionService,
  ],
  exports: [
    CustomersService,
    AddressesService,
    GstinVerificationService,
    CustomerSessionService,
  ],
})
export class CustomersModule {}
