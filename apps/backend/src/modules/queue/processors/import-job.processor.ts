import { Processor } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { ImportsService } from "../../imports/imports.service";
import { DeadLetterQueueService } from "../dead-letter-queue.service";
import { RetryStrategyService } from "../retry-strategy.service";
import { BaseJobProcessor } from "./base-job.processor";

export interface ImportJobData {
  jobId: string;
}

@Processor("imports", {
  concurrency: 2, // Process 2 import jobs concurrently
})
export class ImportJobProcessor extends BaseJobProcessor<ImportJobData> {
  protected readonly queueName = "imports";

  constructor(
    private readonly importsService: ImportsService,
    logger: PinoLogger,
    contextService: ContextService,
    deadLetterQueueService: DeadLetterQueueService,
    retryStrategyService: RetryStrategyService,
  ) {
    super(logger, contextService, deadLetterQueueService, retryStrategyService);
  }

  protected async processJob(job: Job<ImportJobData>): Promise<void> {
    this.logger.debug(
      createLogContext(this.contextService, "processJob", {
        jobId: job.id,
        importJobId: job.data.jobId,
      }),
      "Starting import job processing",
    );

    await this.importsService.processImportJob(job.data.jobId);

    this.logger.debug(
      createLogContext(this.contextService, "processJob", {
        jobId: job.id,
        importJobId: job.data.jobId,
      }),
      "Import job processing completed",
    );
  }
}
