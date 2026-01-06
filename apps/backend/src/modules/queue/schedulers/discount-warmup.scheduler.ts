import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { QueueService } from "../queue.service";

/**
 * Scheduler for discount warmup jobs
 * Enqueues discount warmup jobs on schedule
 */
@Injectable()
export class DiscountWarmupScheduler {
  constructor(
    private readonly queueService: QueueService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Schedule discount warmup - runs at 5 and 35 minutes past each hour
   */
  @Cron("5,35 * * * *")
  async scheduleDiscountWarmup(): Promise<void> {
    try {
      await this.queueService.addJob("discount-warmup", "warmup", {
        triggeredBy: "scheduler",
      });

      this.logger.debug(
        createLogContext(this.contextService, "scheduleDiscountWarmup", {}),
        "Scheduled discount warmup job",
      );
    } catch (error) {
      this.logger.error(
        createLogContext(this.contextService, "scheduleDiscountWarmup", {
          error: error instanceof Error ? error.message : String(error),
        }),
        "Failed to schedule discount warmup job",
      );
    }
  }
}
