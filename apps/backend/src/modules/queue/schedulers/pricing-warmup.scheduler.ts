import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { QueueService } from "../queue.service";

/**
 * Scheduler for pricing warmup jobs
 * Enqueues pricing warmup jobs on schedule
 */
@Injectable()
export class PricingWarmupScheduler {
  constructor(
    private readonly queueService: QueueService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Schedule pricing warmup - runs at 0 and 30 minutes past each hour
   */
  @Cron("0,30 * * * *")
  async schedulePricingWarmup(): Promise<void> {
    try {
      await this.queueService.addJob("pricing-warmup", "warmup", {
        triggeredBy: "scheduler",
      });

      this.logger.debug(
        createLogContext(this.contextService, "schedulePricingWarmup", {}),
        "Scheduled pricing warmup job",
      );
    } catch (error) {
      this.logger.error(
        createLogContext(this.contextService, "schedulePricingWarmup", {
          error: error instanceof Error ? error.message : String(error),
        }),
        "Failed to schedule pricing warmup job",
      );
    }
  }
}
