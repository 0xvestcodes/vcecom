import { Injectable, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { SecretRotationService } from "../services/secret-rotation.service";

/**
 * Secret Rotation Scheduler
 * Automatically rotates JWT secrets on a schedule
 */
@Injectable()
export class SecretRotationScheduler implements OnModuleInit {
  constructor(
    private readonly secretRotationService: SecretRotationService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  onModuleInit() {
    const rotationEnabled = process.env.JWT_SECRET_ROTATION_ENABLED === "true";
    if (!rotationEnabled) {
      this.logger.info(
        createLogContext(this.contextService, "secretRotationSchedulerInit"),
        "Secret rotation scheduler disabled",
      );
    }
  }

  /**
   * Check and rotate secrets daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleSecretRotation() {
    const rotationEnabled = process.env.JWT_SECRET_ROTATION_ENABLED === "true";
    if (!rotationEnabled) {
      return;
    }

    try {
      this.logger.info(
        createLogContext(this.contextService, "secretRotationScheduled"),
        "Running scheduled secret rotation check",
      );

      const rotated = await this.secretRotationService.checkAndRotateIfNeeded();

      if (rotated) {
        this.logger.info(
          createLogContext(this.contextService, "secretRotationScheduled"),
          "Secret rotation completed successfully",
        );
      } else {
        this.logger.debug(
          createLogContext(this.contextService, "secretRotationScheduled"),
          "Secret rotation not needed at this time",
        );
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "secretRotationScheduled",
          error,
        ),
        "Failed to run scheduled secret rotation",
      );
    }
  }
}
