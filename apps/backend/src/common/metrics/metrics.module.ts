import { DynamicModule, Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";

/**
 * Prometheus Metrics Module
 * Only enabled if PROMETHEUS_ENABLED environment variable is set to "true"
 */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS requires class for @Module decorator
export class MetricsModule {
  /**
   * Conditionally register metrics module based on environment variable
   */
  static forRoot(): DynamicModule {
    const isEnabled = process.env.PROMETHEUS_ENABLED === "true";

    if (!isEnabled) {
      // Return empty module if Prometheus is disabled
      return {
        module: MetricsModule,
        providers: [],
        controllers: [],
        exports: [],
      };
    }

    // Return full module with metrics if enabled
    return {
      module: MetricsModule,
      providers: [MetricsService],
      controllers: [MetricsController],
      exports: [MetricsService],
    };
  }
}
