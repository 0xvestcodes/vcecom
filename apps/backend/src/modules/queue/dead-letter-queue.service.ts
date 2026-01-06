import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { QueueService } from "./queue.service";

export interface DeadLetterJob {
  id: string;
  name: string;
  queue: string;
  data: unknown;
  failedReason: string;
  timestamp: Date;
  attemptsMade: number;
  originalJobId?: string;
}

@Injectable()
export class DeadLetterQueueService {
  private readonly DLQ_QUEUE_NAME = "dead-letter";

  constructor(
    private readonly queueService: QueueService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Move a failed job to dead-letter queue
   */
  async moveToDeadLetter(
    queueName: string,
    job: Job,
    error: Error,
  ): Promise<void> {
    try {
      if (!job.id) {
        throw new Error("Job ID is required");
      }
      const dlqData: DeadLetterJob = {
        id: job.id,
        name: job.name,
        queue: queueName,
        data: job.data,
        failedReason: error.message,
        timestamp: new Date(),
        attemptsMade: job.attemptsMade,
        originalJobId: job.id,
      };

      await this.queueService.addJob(
        this.DLQ_QUEUE_NAME,
        `dlq:${queueName}:${job.name}`,
        dlqData,
        {
          jobId: `dlq:${queueName}:${job.id}`,
        },
      );

      this.logger.warn(
        createLogContext(this.contextService, "moveToDeadLetter", {
          queueName,
          jobId: job.id,
          jobName: job.name,
        }),
        `Job moved to dead-letter queue: ${job.name} (${job.id})`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "moveToDeadLetter", error, {
          queueName,
          jobId: job.id,
        }),
        `Failed to move job to dead-letter queue`,
      );
      throw error;
    }
  }

  /**
   * Get all dead-letter jobs
   */
  async getDeadLetterJobs(start = 0, end = 50): Promise<DeadLetterJob[]> {
    try {
      const jobs = await this.queueService.getJobs(
        this.DLQ_QUEUE_NAME,
        "waiting",
        start,
        end,
      );

      return jobs.map((job) => {
        const data = job.data as DeadLetterJob;
        return {
          ...data,
          timestamp: new Date(data.timestamp),
        };
      });
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getDeadLetterJobs", error),
        "Failed to get dead-letter jobs",
      );
      return [];
    }
  }

  /**
   * Get dead-letter queue statistics
   */
  async getDeadLetterStats() {
    try {
      const stats = await this.queueService.getQueueStats(this.DLQ_QUEUE_NAME);
      return {
        total: stats.waiting + stats.active,
        waiting: stats.waiting,
        active: stats.active,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getDeadLetterStats", error),
        "Failed to get dead-letter queue statistics",
      );
      return {
        total: 0,
        waiting: 0,
        active: 0,
      };
    }
  }

  /**
   * Retry a dead-letter job
   */
  async retryDeadLetterJob(dlqJobId: string): Promise<void> {
    try {
      const job = await this.queueService.getJob(this.DLQ_QUEUE_NAME, dlqJobId);

      if (!job) {
        throw new Error(`Dead-letter job ${dlqJobId} not found`);
      }

      const dlqData = job.data as DeadLetterJob;

      // Re-enqueue the original job to its original queue
      await this.queueService.addJob(
        dlqData.queue,
        dlqData.name,
        dlqData.data,
        {
          jobId: dlqData.originalJobId,
          attempts: 1, // Reset attempts
        },
      );

      // Remove from dead-letter queue
      await this.queueService.removeJob(this.DLQ_QUEUE_NAME, dlqJobId);

      this.logger.info(
        createLogContext(this.contextService, "retryDeadLetterJob", {
          dlqJobId,
          originalQueue: dlqData.queue,
          originalJobId: dlqData.originalJobId,
        }),
        `Dead-letter job retried: ${dlqJobId}`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "retryDeadLetterJob", error, {
          dlqJobId,
        }),
        `Failed to retry dead-letter job`,
      );
      throw error;
    }
  }

  /**
   * Delete a dead-letter job
   */
  async deleteDeadLetterJob(dlqJobId: string): Promise<void> {
    try {
      await this.queueService.removeJob(this.DLQ_QUEUE_NAME, dlqJobId);

      this.logger.info(
        createLogContext(this.contextService, "deleteDeadLetterJob", {
          dlqJobId,
        }),
        `Dead-letter job deleted: ${dlqJobId}`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "deleteDeadLetterJob", error, {
          dlqJobId,
        }),
        `Failed to delete dead-letter job`,
      );
      throw error;
    }
  }
}
