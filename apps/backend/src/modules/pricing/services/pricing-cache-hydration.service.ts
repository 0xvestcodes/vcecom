import { Injectable, OnModuleInit } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { TracingService } from "../../../common/tracing/tracing.service";
import { PricingRebuilder } from "./pricing-rebuilder.service";

/**
 * Service for hydrating pricing caches on application startup
 * Ensures fresh Redis state even after Redis restart, container restart, or deployment
 */
@Injectable()
export class PricingCacheHydrationService implements OnModuleInit {
  constructor(
    private readonly rebuilder: PricingRebuilder,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    readonly _tracingService: TracingService,
  ) {}

  /**
   * Hydrate pricing caches on module initialization
   * Runs in background to avoid blocking app startup
   * Starts immediately (0s delay) to serialize with discount hydration
   */
  async onModuleInit(): Promise<void> {
    this.logger.info(
      createLogContext(this.contextService, "onModuleInit", {}),
      "Starting pricing cache hydration in background",
    );
    // Run hydration in background - don't block startup
    // No delay - runs first to serialize with discount hydration
    this.hydrate()
      .then(() => {
        this.logger.info(
          createLogContext(this.contextService, "onModuleInit", {}),
          "Pricing cache hydration completed",
        );
      })
      .catch((error) => {
        this.logger.error(
          createErrorContext(this.contextService, "onModuleInit", error),
          "Failed to hydrate pricing caches - will retry later",
        );
        // Don't throw - cache hydration failure shouldn't prevent app startup
      });
  }

  /**
   * Hydrate all pricing caches
   */
  async hydrate(): Promise<void> {
    this.logger.info(
      createLogContext(this.contextService, "hydrate", {}),
      "Hydrating pricing caches",
    );

    // Rebuild and activate pricing bundle
    await this.rebuilder.rebuildFromDb();
    this.logger.info(
      createLogContext(this.contextService, "hydrate", {}),
      "Hydrated pricing bundle",
    );

    this.logger.info(
      createLogContext(this.contextService, "hydrate", {}),
      "Pricing cache hydration completed",
    );
  }
}
