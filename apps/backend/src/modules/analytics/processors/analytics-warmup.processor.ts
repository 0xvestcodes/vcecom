import { Processor } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DeadLetterQueueService } from "../../queue/dead-letter-queue.service";
import { BaseJobProcessor } from "../../queue/processors/base-job.processor";
import { RetryStrategyService } from "../../queue/retry-strategy.service";
import {
  AnalyticsWarmupJobData,
  AnalyticsWarmupWorker,
} from "../workers/analytics-warmup-worker.service";

@Processor("analytics-warmup", {
  concurrency: 1, // Only one analytics warmup at a time
})
export class AnalyticsWarmupProcessor extends BaseJobProcessor<AnalyticsWarmupJobData> {
  protected readonly queueName = "analytics-warmup";

  constructor(
    private readonly analyticsWarmupWorker: AnalyticsWarmupWorker,
    logger: PinoLogger,
    contextService: ContextService,
    deadLetterQueueService: DeadLetterQueueService,
    retryStrategyService: RetryStrategyService,
  ) {
    super(logger, contextService, deadLetterQueueService, retryStrategyService);
  }

  protected async processJob(job: Job<AnalyticsWarmupJobData>): Promise<void> {
    this.logger.debug(
      createLogContext(this.contextService, "processJob", {
        jobId: job.id,
        jobName: job.name,
        triggeredBy: job.data.triggeredBy,
        type: job.data.type,
      }),
      "Starting analytics warmup",
    );

    try {
      await this.analyticsWarmupWorker.processWarmupJob(job.name);

      this.logger.debug(
        createLogContext(this.contextService, "processJob", {
          jobId: job.id,
          jobName: job.name,
        }),
        "Analytics warmup completed",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "processJob", error, {
          jobId: job.id,
          jobName: job.name,
        }),
        "Analytics warmup failed",
      );
      throw error;
    }
  }
}
