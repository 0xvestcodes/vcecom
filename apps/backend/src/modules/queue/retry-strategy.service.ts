import { Injectable } from "@nestjs/common";
import { JobsOptions } from "bullmq";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createLogContext } from "../../common/logging/logging.helper";

export interface RetryConfig {
  attempts: number;
  backoff: {
    type: "fixed" | "exponential";
    delay: number;
  };
}

/**
 * Service for managing retry strategies with exponential backoff
 */
@Injectable()
export class RetryStrategyService {
  private readonly defaultConfig: RetryConfig = {
    attempts: parseInt(process.env.QUEUE_DEFAULT_RETRY_ATTEMPTS || "3", 10),
    backoff: {
      type: "exponential",
      delay: parseInt(process.env.QUEUE_DEFAULT_BACKOFF_DELAY || "1000", 10),
    },
  };

  private readonly jobTypeConfigs = new Map<string, RetryConfig>();

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get retry configuration for a job type
   */
  getRetryConfig(jobType: string): RetryConfig {
    return this.jobTypeConfigs.get(jobType) || this.defaultConfig;
  }

  /**
   * Set custom retry configuration for a job type
   */
  setRetryConfig(jobType: string, config: Partial<RetryConfig>): void {
    const currentConfig =
      this.jobTypeConfigs.get(jobType) || this.defaultConfig;
    this.jobTypeConfigs.set(jobType, {
      ...currentConfig,
      ...config,
      backoff: {
        ...currentConfig.backoff,
        ...config.backoff,
      },
    });

    this.logger.debug(
      createLogContext(this.contextService, "setRetryConfig", {
        jobType,
        config: this.jobTypeConfigs.get(jobType),
      }),
      `Retry config set for job type: ${jobType}`,
    );
  }

  /**
   * Get job options with retry configuration
   */
  getJobOptions(
    jobType: string,
    overrides?: Partial<JobsOptions>,
  ): JobsOptions {
    const config = this.getRetryConfig(jobType);

    return {
      attempts: config.attempts,
      backoff: {
        type: config.backoff.type,
        delay: config.backoff.delay,
      },
      ...overrides,
    };
  }

  /**
   * Calculate delay for exponential backoff
   */
  calculateBackoffDelay(attemptNumber: number, baseDelay: number): number {
    return Math.min(baseDelay * 2 ** (attemptNumber - 1), 30000); // Max 30 seconds
  }

  /**
   * Check if error is transient (should retry) or permanent (should not retry)
   */
  isTransientError(error: Error): boolean {
    // Network errors, timeouts, and temporary service unavailability are transient
    const transientPatterns = [
      /network/i,
      /timeout/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /temporary/i,
      /unavailable/i,
      /rate limit/i,
      /too many requests/i,
    ];

    const errorMessage = error.message.toLowerCase();
    return transientPatterns.some((pattern) => pattern.test(errorMessage));
  }
}
