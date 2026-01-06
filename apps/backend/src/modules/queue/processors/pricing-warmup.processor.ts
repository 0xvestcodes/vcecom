import { Processor } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { PricingRebuilder } from "../../pricing/services/pricing-rebuilder.service";
import { DeadLetterQueueService } from "../dead-letter-queue.service";
import { RetryStrategyService } from "../retry-strategy.service";
import { BaseJobProcessor } from "./base-job.processor";

export interface PricingWarmupJobData {
  triggeredBy?: string;
}

@Processor("pricing-warmup", {
  concurrency: 1, // Only one pricing warmup at a time
})
export class PricingWarmupProcessor extends BaseJobProcessor<PricingWarmupJobData> {
  protected readonly queueName = "pricing-warmup";

  constructor(
    private readonly pricingRebuilder: PricingRebuilder,
    logger: PinoLogger,
    contextService: ContextService,
    deadLetterQueueService: DeadLetterQueueService,
    retryStrategyService: RetryStrategyService,
  ) {
    super(logger, contextService, deadLetterQueueService, retryStrategyService);
  }

  protected async processJob(job: Job<PricingWarmupJobData>): Promise<void> {
    this.logger.debug(
      createLogContext(this.contextService, "processJob", {
        jobId: job.id,
        triggeredBy: job.data.triggeredBy,
      }),
      "Starting pricing cache warmup",
    );

    await this.pricingRebuilder.rebuildFromDb();

    this.logger.debug(
      createLogContext(this.contextService, "processJob", {
        jobId: job.id,
      }),
      "Pricing cache warmup completed",
    );
  }
}
