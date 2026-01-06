import { WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DeadLetterQueueService } from "../dead-letter-queue.service";
import { RetryStrategyService } from "../retry-strategy.service";

/**
 * Base processor class with common error handling, retry logic, and dead-letter queue routing
 */
export abstract class BaseJobProcessor<T = unknown> extends WorkerHost {
  protected abstract readonly queueName: string;

  constructor(
    protected readonly logger: PinoLogger,
    protected readonly contextService: ContextService,
    protected readonly deadLetterQueueService: DeadLetterQueueService,
    protected readonly retryStrategyService: RetryStrategyService,
  ) {
    super();
  }

  /**
   * Process a job - implement this in subclasses
   */
  protected abstract processJob(job: Job<T>): Promise<void>;

  /**
   * Main process method called by BullMQ
   */
  async process(job: Job<T>): Promise<void> {
    const startTime = Date.now();

    this.logger.info(
      createLogContext(this.contextService, "processJob", {
        queueName: this.queueName,
        jobId: job.id,
        jobName: job.name,
        attempt: job.attemptsMade,
      }),
      `Processing job: ${job.name} (${job.id})`,
    );

    try {
      await this.processJob(job);

      const duration = Date.now() - startTime;
      this.logger.info(
        createLogContext(this.contextService, "processJob", {
          queueName: this.queueName,
          jobId: job.id,
          jobName: job.name,
          duration,
        }),
        `Job completed successfully: ${job.name} (${job.id})`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      this.logger.error(
        createErrorContext(this.contextService, "processJob", err, {
          queueName: this.queueName,
          jobId: job.id,
          jobName: job.name,
          attempt: job.attemptsMade,
          maxAttempts: job.opts.attempts,
          duration,
        }),
        `Job failed: ${job.name} (${job.id})`,
      );

      // Check if this is the last attempt
      const maxAttempts = job.opts.attempts || 3;
      const isLastAttempt = (job.attemptsMade || 0) >= maxAttempts;

      if (isLastAttempt) {
        // Move to dead-letter queue
        await this.deadLetterQueueService.moveToDeadLetter(
          this.queueName,
          job,
          err,
        );
      } else {
        // Check if error is transient - if not, move to DLQ immediately
        if (!this.retryStrategyService.isTransientError(err)) {
          this.logger.warn(
            createLogContext(this.contextService, "processJob", {
              queueName: this.queueName,
              jobId: job.id,
              errorType: "permanent",
            }),
            `Permanent error detected, moving to dead-letter queue immediately`,
          );
          await this.deadLetterQueueService.moveToDeadLetter(
            this.queueName,
            job,
            err,
          );
        }
      }

      // Re-throw to let BullMQ handle retry logic
      throw err;
    }
  }
}
