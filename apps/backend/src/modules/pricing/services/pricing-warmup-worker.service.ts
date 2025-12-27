import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { PricingRebuilder } from "./pricing-rebuilder.service";

/**
 * Warmup worker for pricing caches
 * Runs periodically to refresh pricing bundles before peak traffic
 */
@Injectable()
export class PricingWarmupWorker {
  constructor(
    private readonly rebuilder: PricingRebuilder,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Warmup pricing caches
   * Runs at 0 and 30 minutes past each hour
   * Staggered to avoid concurrent execution with discount warmup
   */
  @Cron("0,30 * * * *")
  async warmup(): Promise<void> {
    try {
      this.logger.debug(
        createLogContext(this.contextService, "warmup", {}),
        "Starting pricing cache warmup",
      );
      await this.rebuilder.rebuildFromDb();
      this.logger.debug(
        createLogContext(this.contextService, "warmup", {}),
        "Pricing cache warmup completed",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "warmup", error),
        "Pricing cache warmup failed",
      );
      // Don't throw - warmup failures shouldn't break the app
    }
  }
}
