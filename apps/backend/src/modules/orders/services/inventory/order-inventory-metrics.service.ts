import { Injectable, Optional } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { MetricsService } from "../../../../common/metrics/metrics.service";

/**
 * Service for tracking inventory commit metrics
 * Integrates with Prometheus metrics for monitoring and alerting
 * MetricsService is optional - if Prometheus is disabled, metrics won't be recorded
 */
@Injectable()
export class OrderInventoryMetricsService {
  constructor(
    @Optional() private readonly metricsService: MetricsService | null,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Record inventory commit failure (CRITICAL metric)
   * This should trigger alerts in monitoring systems
   */
  recordInventoryCommitFailure(orderId: string, cartId: string): void {
    if (!this.metricsService) {
      // Prometheus is disabled, skip metrics recording
      return;
    }

    try {
      this.metricsService.inventoryCommitFailedTotal.inc({
        order_id: orderId,
        cart_id: cartId,
      });

      this.logger.warn(
        createLogContext(this.contextService, "recordInventoryCommitFailure", {
          orderId,
          cartId,
          metric: "inventory_commit_failed_total",
        }),
        "Recorded inventory commit failure metric",
      );
    } catch (error) {
      // Don't fail if metrics recording fails
      this.logger.error(
        createErrorContext(
          this.contextService,
          "recordInventoryCommitFailure",
          error,
          { orderId, cartId },
        ),
        "Failed to record inventory commit failure metric",
      );
    }
  }

  /**
   * Get current inventory commit failure count
   * Useful for health checks and monitoring
   */
  async getInventoryCommitFailureCount(): Promise<number> {
    if (!this.metricsService) {
      // Prometheus is disabled, return 0
      return 0;
    }

    try {
      const metrics = await this.metricsService.getMetrics();
      // Parse the metrics string to extract the failure count
      // This is a simple implementation - in production, you might want to use a metrics client
      const match = metrics.match(
        /inventory_commit_failed_total\{[^}]*\} (\d+)/,
      );
      return match ? parseInt(match[1], 10) : 0;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "getInventoryCommitFailureCount",
          error,
          {},
        ),
        "Failed to get inventory commit failure count",
      );
      return 0;
    }
  }
}
