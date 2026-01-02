import { DynamicModule, Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ContextModule } from "../logging/context.module";
import { LoggerModule } from "../logging/logger.module";
import { TracingInterceptor } from "./tracing.interceptor";
import { TracingService } from "./tracing.service";

/**
 * Global Tracing Module
 * Provides tracing capabilities across the entire application
 * Only enabled if OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is set
 * - TracingService: Utility for creating spans and span-aware loggers
 * - TracingInterceptor: Automatically creates spans for controller endpoints
 */
@Global()
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS requires class for @Module decorator
export class TracingModule {
  /**
   * Conditionally register tracing module based on environment variable
   * Always provides TracingService (it handles disabled state internally)
   * Only registers TracingInterceptor if tracing is enabled
   */
  static forRoot(): DynamicModule {
    const isEnabled = !!(
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    );

    // Always provide TracingService (it handles disabled state internally)
    // Only register TracingInterceptor if tracing is enabled
    const providers = [
      TracingService,
      ...(isEnabled
        ? [
            {
              provide: APP_INTERCEPTOR,
              useClass: TracingInterceptor,
            },
          ]
        : []),
    ];

    return {
      module: TracingModule,
      imports: [LoggerModule, ContextModule],
      providers,
      exports: [TracingService],
    };
  }
}
