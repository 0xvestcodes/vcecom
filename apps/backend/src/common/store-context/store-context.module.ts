import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { DatabaseModule } from "../../modules/database/database.module";
import { StoreContextMiddleware } from "../middleware/store-context.middleware";
import { StoreContextService } from "./store-context.service";

/**
 * Store Context Module
 * Provides store context management services
 * Global module so StoreContextService is available everywhere
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [StoreContextService, StoreContextMiddleware],
  exports: [StoreContextService],
})
export class StoreContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply store context middleware to all routes
    // This extracts X-Store-ID header and sets store context
    consumer.apply(StoreContextMiddleware).forRoutes("*");
  }
}
