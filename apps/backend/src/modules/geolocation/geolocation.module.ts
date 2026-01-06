import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ContextModule } from "../../common/logging/context.module";
import { DatabaseModule } from "../database/database.module";
import { GeoRulesService } from "./geo-rules.service";
import { GeolocationController } from "./geolocation.controller";
import { GeolocationMiddleware } from "./geolocation.middleware";
import { GeolocationService } from "./geolocation.service";
import { RegionPricingService } from "./region-pricing.service";

@Module({
  imports: [DatabaseModule, ContextModule, ScheduleModule],
  controllers: [GeolocationController],
  providers: [GeolocationService, GeoRulesService, RegionPricingService],
  exports: [GeolocationService, GeoRulesService, RegionPricingService],
})
export class GeolocationModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply geolocation middleware to all routes
    // This middleware runs after ContextMiddleware (which extracts IP)
    // Order is important: ContextMiddleware must run first
    consumer.apply(GeolocationMiddleware).forRoutes("*");
  }
}
