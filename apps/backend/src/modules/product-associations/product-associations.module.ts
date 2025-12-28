import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { ProductAssociationsController } from "./product-associations.controller";
import { ProductAssociationsService } from "./services/product-associations.service";
import { ProductAssociationsAnalyzer } from "./services/product-associations-analyzer.service";
import { StorefrontProductAssociationsController } from "./storefront-product-associations.controller";

@Module({
  imports: [RedisStoreModule, ScheduleModule],
  controllers: [
    ProductAssociationsController,
    StorefrontProductAssociationsController,
  ],
  providers: [ProductAssociationsService, ProductAssociationsAnalyzer],
  exports: [ProductAssociationsService],
})
export class ProductAssociationsModule {}
