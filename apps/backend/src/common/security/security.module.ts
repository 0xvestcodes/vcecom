import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { LoggerModule } from "../logging/logger.module";
import { SecurityHeadersMiddleware } from "../middleware/security-headers.middleware";

/**
 * Security Module
 * Provides security-related middleware and services
 */
@Global()
@Module({
  imports: [LoggerModule],
  providers: [SecurityHeadersMiddleware],
  exports: [SecurityHeadersMiddleware],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply security headers middleware to all routes
    // This should run after Helmet but adds additional headers
    consumer.apply(SecurityHeadersMiddleware).forRoutes("*");
  }
}
