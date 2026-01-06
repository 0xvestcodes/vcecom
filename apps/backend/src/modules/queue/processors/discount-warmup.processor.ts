import { Processor } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { DiscountWarmupWorker } from "../../discounts/services/discount-warmup-worker.service";
import { DeadLetterQueueService } from "../dead-letter-queue.service";
import { RetryStrategyService } from "../retry-strategy.service";
import { BaseJobProcessor } from "./base-job.processor";

export interface DiscountWarmupJobData {
  triggeredBy?: string;
}

@Processor("discount-warmup", {
  concurrency: 1, // Only one discount warmup at a time
})
export class DiscountWarmupProcessor extends BaseJobProcessor<DiscountWarmupJobData> {
  protected readonly queueName = "discount-warmup";

  constructor(
    private readonly discountWarmupWorker: DiscountWarmupWorker,
    logger: PinoLogger,
    contextService: ContextService,
    deadLetterQueueService: DeadLetterQueueService,
    retryStrategyService: RetryStrategyService,
  ) {
    super(logger, contextService, deadLetterQueueService, retryStrategyService);
  }

  protected async processJob(job: Job<DiscountWarmupJobData>): Promise<void> {
    this.logger.debug(
      createLogContext(this.contextService, "processJob", {
        jobId: job.id,
        triggeredBy: job.data.triggeredBy,
      }),
      "Starting discount cache warmup",
    );

    await this.discountWarmupWorker.warmup();

    this.logger.debug(
      createLogContext(this.contextService, "processJob", {
        jobId: job.id,
      }),
      "Discount cache warmup completed",
    );
  }
}
