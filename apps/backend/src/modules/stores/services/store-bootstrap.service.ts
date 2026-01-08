import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { eq, stores } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";

/**
 * Service to ensure default store exists on application startup
 * Creates a default store if none exists, using environment variables for configuration
 */
@Injectable()
export class StoreBootstrapService implements OnModuleInit {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Ensure default store exists on module initialization
   * Called automatically by NestJS when the module is initialized
   */
  async onModuleInit(): Promise<void> {
    // Skip if explicitly disabled
    if (process.env.ENSURE_STORE_ON_STARTUP === "false") {
      this.logger.debug(
        createLogContext(this.contextService, "storeBootstrapSkipped", {}),
        "Store bootstrap skipped - ENSURE_STORE_ON_STARTUP=false",
      );
      return;
    }

    try {
      await this.ensureDefaultStore();
    } catch (error) {
      // Log error but don't fail startup - store can be created manually
      this.logger.error(
        createErrorContext(this.contextService, "storeBootstrapError", error),
        "Failed to ensure default store on startup - application will continue",
      );
      // Don't throw - allow app to start even if store creation fails
    }
  }

  /**
   * Ensure default store exists
   */
  private async ensureDefaultStore(): Promise<void> {
    const startTime = Date.now();

    try {
      // Check if default store exists
      const [defaultStore] = await this.db
        .select()
        .from(stores)
        .where(eq(stores.isDefault, true))
        .limit(1);

      if (defaultStore) {
        this.logger.debug(
          createLogContext(this.contextService, "defaultStoreExists", {
            storeId: defaultStore.id,
            storeName: defaultStore.name,
            elapsedMs: Date.now() - startTime,
          }),
          "Default store already exists",
        );
        return;
      }

      // Check if any store exists
      const [firstStore] = await this.db.select().from(stores).limit(1);

      if (firstStore) {
        // Store exists but not marked as default - mark it as default
        await this.db
          .update(stores)
          .set({ isDefault: true })
          .where(eq(stores.id, firstStore.id));

        this.logger.info(
          createLogContext(this.contextService, "storeMarkedAsDefault", {
            storeId: firstStore.id,
            storeName: firstStore.name,
            elapsedMs: Date.now() - startTime,
          }),
          "Existing store marked as default on startup",
        );
        return;
      }

      // No store exists - create default store using environment variables
      const storeName =
        process.env.NEXT_PUBLIC_STORE_NAME ||
        process.env.STORE_NAME ||
        "Default Store";
      const storeDomain =
        process.env.NEXT_PUBLIC_STORE_DOMAIN ||
        process.env.STORE_DOMAIN ||
        "localhost";
      const storeCurrency =
        process.env.NEXT_PUBLIC_STORE_CURRENCY ||
        process.env.STORE_CURRENCY ||
        "INR";
      const storePrimaryColor =
        process.env.NEXT_PUBLIC_STORE_PRIMARY_COLOR ||
        process.env.STORE_PRIMARY_COLOR ||
        null;
      const storeLogoUrl =
        process.env.NEXT_PUBLIC_STORE_LOGO_URL ||
        process.env.STORE_LOGO_URL ||
        null;

      try {
        const [createdStore] = await this.db
          .insert(stores)
          .values({
            name: storeName,
            domain: storeDomain,
            currency: storeCurrency,
            primaryColor: storePrimaryColor,
            logoUrl: storeLogoUrl,
            isDefault: true,
          })
          .returning();

        if (!createdStore) {
          throw new Error("Failed to create default store - no store returned");
        }

        this.logger.info(
          createLogContext(this.contextService, "defaultStoreCreated", {
            storeId: createdStore.id,
            storeName: createdStore.name,
            storeDomain: createdStore.domain,
            elapsedMs: Date.now() - startTime,
          }),
          "Default store created successfully on startup",
        );
      } catch (insertError: unknown) {
        // Handle race condition: if multiple instances start simultaneously,
        // one might create the store while another is trying to create it
        // Check if error is a unique constraint violation on domain
        if (
          insertError instanceof Error &&
          (insertError.message.includes("unique constraint") ||
            insertError.message.includes("duplicate key") ||
            insertError.message.includes("UNIQUE constraint"))
        ) {
          // Store was created by another instance - query for it
          const [existingStore] = await this.db
            .select()
            .from(stores)
            .where(eq(stores.domain, storeDomain))
            .limit(1);

          if (existingStore) {
            // Mark as default if not already
            if (!existingStore.isDefault) {
              await this.db
                .update(stores)
                .set({ isDefault: true })
                .where(eq(stores.id, existingStore.id));
            }

            this.logger.info(
              createLogContext(
                this.contextService,
                "defaultStoreFoundAfterRace",
                {
                  storeId: existingStore.id,
                  storeName: existingStore.name,
                  elapsedMs: Date.now() - startTime,
                },
              ),
              "Default store found after race condition (created by another instance)",
            );
            return;
          }
        }

        // Re-throw if it's not a race condition
        throw insertError;
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "ensureDefaultStore", error, {
          elapsedMs: Date.now() - startTime,
        }),
        "Error ensuring default store exists",
      );
      throw error;
    }
  }
}
