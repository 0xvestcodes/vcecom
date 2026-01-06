import { Processor } from "@nestjs/bullmq";
import { forwardRef, Inject } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { AbandonedCartRecoveryService } from "../../carts/services/abandoned-cart-recovery.service";
import { DeadLetterQueueService } from "../dead-letter-queue.service";
import { RetryStrategyService } from "../retry-strategy.service";
import { BaseJobProcessor } from "./base-job.processor";

export interface AbandonedCartRecoveryJobData {
  recoveryId: string;
  attemptNumber: number;
}

@Processor("abandoned-cart-recovery")
export class AbandonedCartRecoveryProcessor extends BaseJobProcessor<AbandonedCartRecoveryJobData> {
  protected readonly queueName = "abandoned-cart-recovery";

  constructor(
    @Inject(forwardRef(() => AbandonedCartRecoveryService))
    private readonly recoveryService: AbandonedCartRecoveryService,
    logger: PinoLogger,
    contextService: ContextService,
    deadLetterQueueService: DeadLetterQueueService,
    retryStrategyService: RetryStrategyService,
  ) {
    super(logger, contextService, deadLetterQueueService, retryStrategyService);
  }

  protected async processJob(
    job: import("bullmq").Job<AbandonedCartRecoveryJobData>,
  ): Promise<void> {
    const { recoveryId, attemptNumber } = job.data;

    this.logger.info(
      createLogContext(this.contextService, "processRecoveryJob", {
        recoveryId,
        attemptNumber,
        jobId: job.id,
      }),
      `Processing recovery attempt ${attemptNumber} for recovery ${recoveryId}`,
    );

    await this.recoveryService.processRecoveryAttempt(
      recoveryId,
      attemptNumber,
    );
  }
}
