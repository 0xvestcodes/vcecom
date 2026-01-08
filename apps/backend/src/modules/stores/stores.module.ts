import { Module } from "@nestjs/common";
import { StoreBootstrapService } from "./services/store-bootstrap.service";
import { StorefrontConfigController } from "./storefront-config.controller";
import { StoresController } from "./stores.controller";
import { StoresService } from "./stores.service";

@Module({
  controllers: [StoresController, StorefrontConfigController],
  providers: [StoresService, StoreBootstrapService],
  exports: [StoresService], // Export for use in other modules
})
export class StoresModule {}
