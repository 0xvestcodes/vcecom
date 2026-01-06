import { Injectable, OnModuleInit } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { BundleWarmupService } from "./bundle-warmup.service";

/**
 * Service for hydrating bundle cache on application startup
 * Ensures all active bundles are cached in Redis on startup
 */
@Injectable()
export class BundleCacheHydrationService implements OnModuleInit {
  constructor(
    private readonly bundleWarmupService: BundleWarmupService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Hydrate bundle caches on module initialization
   * Runs in background to avoid blocking app startup
   * Delayed by 9 seconds to serialize with other warmups
   */
  async onModuleInit(): Promise<void> {
    this.logger.info(
      createLogContext(this.contextService, "onModuleInit", {}),
      "Starting bundle cache hydration in background (delayed 9s to serialize with other warmups)",
    );
    // Delay hydration to serialize with pricing/discount/feature-flags hydration
    setTimeout(() => {
      // Run hydration in background - don't block startup
      this.hydrate()
        .then(() => {
          this.logger.info(
            createLogContext(this.contextService, "onModuleInit", {}),
            "Bundle cache hydration completed successfully",
          );
        })
        .catch((error) => {
          // Don't block startup if hydration fails
          this.logger.error(
            createErrorContext(this.contextService, "onModuleInit", error),
            "Failed to hydrate bundle cache on startup - will retry later",
          );
          this.logger.warn(
            createLogContext(this.contextService, "onModuleInit", {}),
            "Continuing startup without bundle cache hydration, system will fallback to DB queries",
          );
        });
    }, 9000); // 9 second delay to serialize with other warmups
  }

  /**
   * Hydrate all bundle caches
   */
  async hydrate(): Promise<void> {
    this.logger.info(
      createLogContext(this.contextService, "hydrate", {}),
      "Hydrating bundle caches",
    );

    await this.bundleWarmupService.warmupAllBundles();

    this.logger.info(
      createLogContext(this.contextService, "hydrate", {}),
      "Bundle cache hydration completed",
    );
  }
}
