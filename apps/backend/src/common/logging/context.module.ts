import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ContextMiddleware } from "./context.middleware";
import { ContextService } from "./context.service";
import { FingerprintMiddleware } from "../middleware/fingerprint.middleware";

@Global() // Make ContextModule global so ContextService is available everywhere
@Module({
  providers: [ContextService, FingerprintMiddleware],
  exports: [ContextService],
})
export class ContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply ContextMiddleware first (extracts IP)
    consumer.apply(ContextMiddleware).forRoutes("*");
    // Apply FingerprintMiddleware second (uses IP from context)
    consumer.apply(FingerprintMiddleware).forRoutes("*");
  }
}
