import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { RedisStoreService } from "../redis-store/redis-store.service";

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface JobData {
  [key: string]: unknown;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();

  constructor(
    private readonly redisStoreService: RedisStoreService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get or create a queue
   */
  async getQueue(queueName: string): Promise<Queue> {
    const existingQueue = this.queues.get(queueName);
    if (existingQueue) {
      return existingQueue;
    }

    const redisClient = await this.redisStoreService.getClient();
    const queue = new Queue(queueName, {
      connection: redisClient,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: {
          age: 24 * 3600, // 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // 7 days
          count: 5000,
        },
      },
    });

    this.queues.set(queueName, queue);

    this.logger.info(
      createLogContext(this.contextService, "getQueue", { queueName }),
      `Queue '${queueName}' created`,
    );

    return queue;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T = JobData>(
    queueName: string,
    jobName: string,
    data: T,
    options?: {
      delay?: number;
      attempts?: number;
      backoff?: {
        type: "fixed" | "exponential";
        delay: number;
      };
      priority?: number;
      jobId?: string;
    },
  ) {
    const queue = await this.getQueue(queueName);
    const job = await queue.add(jobName, data, {
      ...options,
      jobId: options?.jobId,
    });

    this.logger.debug(
      createLogContext(this.contextService, "addJob", {
        queueName,
        jobName,
        jobId: job.id,
      }),
      `Job '${jobName}' added to queue '${queueName}'`,
    );

    return job;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    const queue = await this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    const isPaused = await queue.isPaused();

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }

  /**
   * Get all registered queues
   */
  getRegisteredQueues(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = await this.getQueue(queueName);
    await queue.pause();

    this.logger.info(
      createLogContext(this.contextService, "pauseQueue", { queueName }),
      `Queue '${queueName}' paused`,
    );
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = await this.getQueue(queueName);
    await queue.resume();

    this.logger.info(
      createLogContext(this.contextService, "resumeQueue", { queueName }),
      `Queue '${queueName}' resumed`,
    );
  }

  /**
   * Get jobs from a queue
   */
  async getJobs(
    queueName: string,
    status:
      | "waiting"
      | "active"
      | "completed"
      | "failed"
      | "delayed" = "waiting",
    start = 0,
    end = 10,
  ) {
    const queue = await this.getQueue(queueName);

    let jobs: Awaited<ReturnType<Queue["getWaiting"]>>;
    switch (status) {
      case "waiting":
        jobs = await queue.getWaiting(start, end);
        break;
      case "active":
        jobs = await queue.getActive(start, end);
        break;
      case "completed":
        jobs = await queue.getCompleted(start, end);
        break;
      case "failed":
        jobs = await queue.getFailed(start, end);
        break;
      case "delayed":
        jobs = await queue.getDelayed(start, end);
        break;
      default:
        jobs = await queue.getWaiting(start, end);
    }

    return jobs;
  }

  /**
   * Get a specific job
   */
  async getJob(queueName: string, jobId: string) {
    const queue = await this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  /**
   * Remove a job
   */
  async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = await this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.info(
        createLogContext(this.contextService, "removeJob", {
          queueName,
          jobId,
        }),
        `Job '${jobId}' removed from queue '${queueName}'`,
      );
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(queueName: string, jobId: string): Promise<void> {
    const queue = await this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (job) {
      await job.retry();
      this.logger.info(
        createLogContext(this.contextService, "retryJob", {
          queueName,
          jobId,
        }),
        `Job '${jobId}' retried in queue '${queueName}'`,
      );
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    for (const [queueName, queue] of this.queues.entries()) {
      try {
        await queue.close();
        this.logger.info(
          createLogContext(this.contextService, "onModuleDestroy", {
            queueName,
          }),
          `Queue '${queueName}' closed`,
        );
      } catch (error) {
        this.logger.error(
          createErrorContext(this.contextService, "onModuleDestroy", error, {
            queueName,
          }),
          `Failed to close queue '${queueName}'`,
        );
      }
    }
    this.queues.clear();
  }
}
