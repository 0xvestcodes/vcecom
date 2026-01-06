import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { SearchIndexerService } from "../search-indexer.service";

/**
 * Variant indexing service
 * Handles incremental indexing when variants are created, updated, or deleted
 * Since variants are part of products, we reindex the parent product
 */
@Injectable()
export class VariantIndexingService {
  constructor(
    private readonly searchIndexer: SearchIndexerService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Reindex parent product after variant creation or update
   * Should be called from variant operations
   */
  async indexVariant(productId: string): Promise<void> {
    try {
      // Reindex the parent product to update variant information
      await this.searchIndexer.indexProduct(productId);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "VariantIndexingService.indexVariant",
          { productId },
        ),
        "Product queued for reindexing after variant change",
      );
    } catch (error) {
      // Don't throw - indexing failures shouldn't break variant operations
      this.logger.error(
        createErrorContext(
          this.contextService,
          "VariantIndexingService.indexVariant",
          error,
          { productId },
        ),
        "Failed to reindex product after variant change (non-blocking)",
      );
    }
  }

  /**
   * Reindex parent products after multiple variant changes
   */
  async indexVariants(productIds: string[]): Promise<void> {
    if (productIds.length === 0) {
      return;
    }

    // Deduplicate product IDs
    const uniqueProductIds = Array.from(new Set(productIds));

    try {
      await this.searchIndexer.indexProducts(uniqueProductIds);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "VariantIndexingService.indexVariants",
          { productIds: uniqueProductIds.length },
        ),
        "Products queued for reindexing after variant changes",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "VariantIndexingService.indexVariants",
          error,
          { count: uniqueProductIds.length },
        ),
        "Failed to reindex products after variant changes (non-blocking)",
      );
    }
  }
}
