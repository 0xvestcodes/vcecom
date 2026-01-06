import { Injectable, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { QueueService } from "./queue.service";

export interface ScheduledJobConfig {
  queueName: string;
  jobName: string;
  cronExpression: string;
  data?: unknown;
  enabled?: boolean;
}

@Injectable()
export class ScheduledJobsService implements OnModuleInit {
  private readonly scheduledJobs = new Map<string, ScheduledJobConfig>();

  constructor(
    private readonly queueService: QueueService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    // Register default scheduled jobs
    this.registerDefaultJobs();
  }

  /**
   * Register a scheduled job
   */
  registerScheduledJob(config: ScheduledJobConfig): void {
    if (config.enabled === false) {
      this.logger.debug(
        createLogContext(this.contextService, "registerScheduledJob", {
          queueName: config.queueName,
          jobName: config.jobName,
        }),
        `Scheduled job disabled: ${config.jobName}`,
      );
      return;
    }

    this.scheduledJobs.set(config.jobName, config);

    // Create a dynamic cron job
    const jobKey = `scheduled:${config.queueName}:${config.jobName}`;
    const cronJob = this.createCronJob(config);

    this.schedulerRegistry.addCronJob(jobKey, cronJob);
    cronJob.start();

    this.logger.info(
      createLogContext(this.contextService, "registerScheduledJob", {
        queueName: config.queueName,
        jobName: config.jobName,
        cronExpression: config.cronExpression,
      }),
      `Registered scheduled job: ${config.jobName}`,
    );
  }

  /**
   * Unregister a scheduled job
   */
  unregisterScheduledJob(jobName: string): void {
    const config = this.scheduledJobs.get(jobName);
    if (!config) {
      return;
    }

    const jobKey = `scheduled:${config.queueName}:${jobName}`;
    const cronJob = this.schedulerRegistry.getCronJob(jobKey);

    if (cronJob) {
      cronJob.stop();
      this.schedulerRegistry.deleteCronJob(jobKey);
    }

    this.scheduledJobs.delete(jobName);

    this.logger.info(
      createLogContext(this.contextService, "unregisterScheduledJob", {
        jobName,
      }),
      `Unregistered scheduled job: ${jobName}`,
    );
  }

  /**
   * Create a cron job that enqueues work
   */
  private createCronJob(config: ScheduledJobConfig): CronJob {
    return new CronJob(
      config.cronExpression,
      async () => {
        await this.enqueueScheduledJob(config);
      },
      null, // onComplete callback
      false, // start immediately
      "UTC", // timezone
    );
  }

  /**
   * Enqueue a scheduled job
   */
  private async enqueueScheduledJob(config: ScheduledJobConfig): Promise<void> {
    try {
      await this.queueService.addJob(
        config.queueName,
        config.jobName,
        config.data || {},
        {
          jobId: `scheduled:${config.jobName}:${Date.now()}`,
        },
      );

      this.logger.debug(
        createLogContext(this.contextService, "enqueueScheduledJob", {
          queueName: config.queueName,
          jobName: config.jobName,
        }),
        `Enqueued scheduled job: ${config.jobName}`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "enqueueScheduledJob", error, {
          queueName: config.queueName,
          jobName: config.jobName,
        }),
        `Failed to enqueue scheduled job: ${config.jobName}`,
      );
      throw error;
    }
  }

  /**
   * Register default scheduled jobs
   */
  private registerDefaultJobs(): void {
    // Pricing warmup - runs at 0 and 30 minutes past each hour
    this.registerScheduledJob({
      queueName: "pricing-warmup",
      jobName: "warmup",
      cronExpression: "0,30 * * * *",
      data: { triggeredBy: "scheduler" },
    });

    // Discount warmup - runs at 5 and 35 minutes past each hour
    this.registerScheduledJob({
      queueName: "discount-warmup",
      jobName: "warmup",
      cronExpression: "5,35 * * * *",
      data: { triggeredBy: "scheduler" },
    });
  }

  /**
   * Get all registered scheduled jobs
   */
  getScheduledJobs(): ScheduledJobConfig[] {
    return Array.from(this.scheduledJobs.values());
  }
}
