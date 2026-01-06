import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import {
  DeadLetterJob,
  DeadLetterQueueService,
} from "../../queue/dead-letter-queue.service";
import { QueueService, QueueStats } from "../../queue/queue.service";

export interface QueueInfo {
  name: string;
  stats: QueueStats;
}

export interface QueueJobInfo {
  id: string;
  name: string;
  data: unknown;
  state: string;
  progress: number | object | string;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
}

@Injectable()
export class QueueMonitoringService {
  constructor(
    private readonly queueService: QueueService,
    private readonly deadLetterQueueService: DeadLetterQueueService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get all queues with their statistics
   */
  async getAllQueues(): Promise<QueueInfo[]> {
    try {
      const queueNames = this.queueService.getRegisteredQueues();
      const queues: QueueInfo[] = [];

      for (const queueName of queueNames) {
        try {
          const stats = await this.queueService.getQueueStats(queueName);
          queues.push({
            name: queueName,
            stats,
          });
        } catch (error) {
          this.logger.error(
            createErrorContext(this.contextService, "getAllQueues", error, {
              queueName,
            }),
            `Failed to get stats for queue: ${queueName}`,
          );
        }
      }

      return queues;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getAllQueues", error),
        "Failed to get all queues",
      );
      return [];
    }
  }

  /**
   * Get detailed information about a specific queue
   */
  async getQueueDetails(queueName: string): Promise<QueueInfo | null> {
    try {
      const stats = await this.queueService.getQueueStats(queueName);
      return {
        name: queueName,
        stats,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getQueueDetails", error, {
          queueName,
        }),
        `Failed to get queue details: ${queueName}`,
      );
      return null;
    }
  }

  /**
   * Get jobs from a queue with status
   */
  async getQueueJobs(
    queueName: string,
    status:
      | "waiting"
      | "active"
      | "completed"
      | "failed"
      | "delayed" = "waiting",
    start = 0,
    end = 50,
  ): Promise<QueueJobInfo[]> {
    try {
      const jobs = await this.queueService.getJobs(
        queueName,
        status,
        start,
        end,
      );

      return Promise.all(
        jobs.map(async (job) => {
          if (!job.id) {
            throw new Error("Job ID is required");
          }
          // Convert progress to compatible type (boolean -> number)
          let progress: number | object | string;
          if (typeof job.progress === "boolean") {
            progress = job.progress ? 1 : 0;
          } else {
            progress = job.progress as number | object | string;
          }
          return {
            id: job.id,
            name: job.name,
            data: job.data,
            state: await job.getState(),
            progress,
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
          };
        }),
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getQueueJobs", error, {
          queueName,
          status,
        }),
        `Failed to get jobs from queue: ${queueName}`,
      );
      return [];
    }
  }

  /**
   * Get a specific job details
   */
  async getJobDetails(
    queueName: string,
    jobId: string,
  ): Promise<QueueJobInfo | null> {
    try {
      const job = await this.queueService.getJob(queueName, jobId);

      if (!job) {
        return null;
      }

      const jobState = await job.getState();
      if (!job.id) {
        throw new Error("Job ID is required");
      }
      return {
        id: job.id,
        name: job.name,
        data: job.data,
        state: jobState,
        progress: job.progress as number | object | string,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getJobDetails", error, {
          queueName,
          jobId,
        }),
        `Failed to get job details: ${queueName}:${jobId}`,
      );
      return null;
    }
  }

  /**
   * Get dead-letter queue jobs
   */
  async getDeadLetterJobs(start = 0, end = 50): Promise<DeadLetterJob[]> {
    return this.deadLetterQueueService.getDeadLetterJobs(start, end);
  }

  /**
   * Get dead-letter queue statistics
   */
  async getDeadLetterStats() {
    return this.deadLetterQueueService.getDeadLetterStats();
  }

  /**
   * Get overall queue metrics
   */
  async getQueueMetrics() {
    try {
      const queues = await this.getAllQueues();
      const dlqStats = await this.getDeadLetterStats();

      const totalWaiting = queues.reduce((sum, q) => sum + q.stats.waiting, 0);
      const totalActive = queues.reduce((sum, q) => sum + q.stats.active, 0);
      const totalCompleted = queues.reduce(
        (sum, q) => sum + q.stats.completed,
        0,
      );
      const totalFailed = queues.reduce((sum, q) => sum + q.stats.failed, 0);
      const totalDelayed = queues.reduce((sum, q) => sum + q.stats.delayed, 0);

      return {
        queues: queues.length,
        totalWaiting,
        totalActive,
        totalCompleted,
        totalFailed,
        totalDelayed,
        deadLetterQueue: dlqStats,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getQueueMetrics", error),
        "Failed to get queue metrics",
      );
      return {
        queues: 0,
        totalWaiting: 0,
        totalActive: 0,
        totalCompleted: 0,
        totalFailed: 0,
        totalDelayed: 0,
        deadLetterQueue: {
          total: 0,
          waiting: 0,
          active: 0,
        },
      };
    }
  }
}
