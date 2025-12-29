import {
  DynamicModule,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { NodeSDK } from "@opentelemetry/sdk-node";

/**
 * OpenTelemetry Tracing Module
 * Initializes OTEL SDK and provides tracing capabilities
 * Note: SDK initialization happens in main.ts before NestFactory
 * Only enabled if OTEL_EXPORTER_ZIPKIN_ENDPOINT is set
 */
@Module({})
export class OtelTracingModule implements OnModuleInit, OnModuleDestroy {
  private sdk: NodeSDK | null = null;

  /**
   * Conditionally register OTEL tracing module based on environment variable
   */
  static forRoot(): DynamicModule {
    const isEnabled = !!process.env.OTEL_EXPORTER_ZIPKIN_ENDPOINT;

    if (!isEnabled) {
      // Return empty module if tracing is disabled
      return {
        module: OtelTracingModule,
        providers: [],
        exports: [],
      };
    }

    // Return full module if enabled
    return {
      module: OtelTracingModule,
      providers: [],
      exports: [],
    };
  }

  onModuleInit() {
    // SDK is initialized in main.ts before NestFactory
    // This module just provides a place to manage tracing lifecycle
  }

  async onModuleDestroy() {
    if (this.sdk) {
      await this.sdk.shutdown();
    }
  }
}
