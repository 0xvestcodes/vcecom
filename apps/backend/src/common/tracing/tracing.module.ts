import { DynamicModule, Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ContextModule } from "../logging/context.module";
import { LoggerModule } from "../logging/logger.module";
import { TracingInterceptor } from "./tracing.interceptor";
import { TracingService } from "./tracing.service";

/**
 * Global Tracing Module
 * Provides tracing capabilities across the entire application
 * Only enabled if OTEL_EXPORTER_ZIPKIN_ENDPOINT is set
 * - TracingService: Utility for creating spans and span-aware loggers
 * - TracingInterceptor: Automatically creates spans for controller endpoints
 */
@Global()
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS requires class for @Module decorator
export class TracingModule {
  /**
   * Conditionally register tracing module based on environment variable
   */
  static forRoot(): DynamicModule {
    const isEnabled = !!process.env.OTEL_EXPORTER_ZIPKIN_ENDPOINT;

    if (!isEnabled) {
      // Return empty module if tracing is disabled
      return {
        module: TracingModule,
        providers: [],
        exports: [],
      };
    }

    // Return full module with tracing if enabled
    return {
      module: TracingModule,
      imports: [LoggerModule, ContextModule],
      providers: [
        TracingService,
        {
          provide: APP_INTERCEPTOR,
          useClass: TracingInterceptor,
        },
      ],
      exports: [TracingService],
    };
  }
}
