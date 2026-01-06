import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { QueueService } from "../../queue/queue.service";

@Injectable()
export class AnalyticsWarmupScheduler {
  constructor(
    private readonly queueService: QueueService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Schedule analytics warmup - runs hourly at 10 minutes past the hour
   */
  @Cron("10 * * * *")
  async scheduleAnalyticsWarmup(): Promise<void> {
    try {
      await this.queueService.addJob(
        "analytics-warmup",
        "compute-order-metrics",
        { triggeredBy: "scheduler", type: "hourly" },
      );

      await this.queueService.addJob(
        "analytics-warmup",
        "compute-sales-metrics",
        { triggeredBy: "scheduler", type: "hourly" },
      );

      this.logger.debug(
        createLogContext(this.contextService, "scheduleAnalyticsWarmup", {}),
        "Scheduled analytics warmup jobs",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "scheduleAnalyticsWarmup",
          error,
          {},
        ),
        "Failed to schedule analytics warmup jobs",
      );
    }
  }

  /**
   * Schedule daily analytics computation - runs at midnight
   */
  @Cron("0 0 * * *")
  async scheduleDailyAnalytics(): Promise<void> {
    try {
      await this.queueService.addJob(
        "analytics-warmup",
        "compute-customer-segmentation",
        { triggeredBy: "scheduler", type: "daily" },
      );

      await this.queueService.addJob(
        "analytics-warmup",
        "compute-product-performance",
        { triggeredBy: "scheduler", type: "daily" },
      );

      this.logger.debug(
        createLogContext(this.contextService, "scheduleDailyAnalytics", {}),
        "Scheduled daily analytics jobs",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "scheduleDailyAnalytics",
          error,
          {},
        ),
        "Failed to schedule daily analytics jobs",
      );
    }
  }

  /**
   * Schedule weekly analytics computation - runs on Sunday at 2 AM
   */
  @Cron("0 2 * * 0")
  async scheduleWeeklyAnalytics(): Promise<void> {
    try {
      await this.queueService.addJob(
        "analytics-warmup",
        "compute-customer-segmentation",
        { triggeredBy: "scheduler", type: "weekly" },
      );

      await this.queueService.addJob(
        "analytics-warmup",
        "compute-rfm-analysis",
        { triggeredBy: "scheduler", type: "weekly" },
      );

      this.logger.debug(
        createLogContext(this.contextService, "scheduleWeeklyAnalytics", {}),
        "Scheduled weekly analytics jobs",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "scheduleWeeklyAnalytics",
          error,
          {},
        ),
        "Failed to schedule weekly analytics jobs",
      );
    }
  }
}
