import { Inject, Injectable } from "@nestjs/common";
import { productImages, sql } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

@Injectable()
export class MediaTransactionService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Execute operation within a transaction with retry logic
   */
  async withTransaction<T>(
    operation: () => Promise<T>,
    retries = MAX_RETRIES,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.db.transaction(async (tx) => {
          return await operation();
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a deadlock or serialization error (PostgreSQL error codes)
        const errorMessage = lastError.message.toLowerCase();
        const isRetryable =
          errorMessage.includes("deadlock") ||
          errorMessage.includes("serialization") ||
          errorMessage.includes("could not serialize");

        if (!isRetryable || attempt === retries) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "withTransaction",
              lastError,
              { attempt, retries },
            ),
            "Transaction failed",
          );
          throw lastError;
        }

        // Wait before retry with exponential backoff
        const delay = RETRY_DELAY_MS * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));

        this.logger.warn(
          createLogContext(this.contextService, "withTransaction", {
            attempt,
            retries,
            delay,
            error: lastError.message,
          }),
          "Retrying transaction after error",
        );
      }
    }

    throw lastError || new Error("Transaction failed after retries");
  }

  /**
   * Lock product images for a specific product
   * Prevents concurrent modifications
   */
  async lockProductImages(productId: string): Promise<void> {
    try {
      // Use SELECT FOR UPDATE to acquire row-level lock
      await this.db.execute(
        sql`SELECT * FROM ${productImages} WHERE ${productImages.productId} = ${productId} FOR UPDATE`,
      );

      this.logger.debug(
        createLogContext(this.contextService, "lockProductImages", {
          productId,
        }),
        "Locked product images",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "lockProductImages", error, {
          productId,
        }),
        "Failed to lock product images",
      );
      throw error;
    }
  }

  /**
   * Lock variant images for a specific variant
   * Prevents concurrent modifications
   */
  async lockVariantImages(productId: string, variantId: string): Promise<void> {
    try {
      // Use SELECT FOR UPDATE to acquire row-level lock
      await this.db.execute(
        sql`SELECT * FROM ${productImages} WHERE ${productImages.productId} = ${productId} AND ${productImages.variantId} = ${variantId} FOR UPDATE`,
      );

      this.logger.debug(
        createLogContext(this.contextService, "lockVariantImages", {
          productId,
          variantId,
        }),
        "Locked variant images",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "lockVariantImages", error, {
          productId,
          variantId,
        }),
        "Failed to lock variant images",
      );
      throw error;
    }
  }

  /**
   * Execute operation with product image lock
   */
  async withProductImageLock<T>(
    productId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(async () => {
      await this.lockProductImages(productId);
      return await operation();
    });
  }

  /**
   * Execute operation with variant image lock
   */
  async withVariantImageLock<T>(
    productId: string,
    variantId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(async () => {
      await this.lockVariantImages(productId, variantId);
      return await operation();
    });
  }
}
