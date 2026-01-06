import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { SearchIndexerService } from "../search-indexer.service";

/**
 * Products indexing service
 * Handles incremental indexing of products when they are created, updated, or deleted
 */
@Injectable()
export class ProductsIndexingService {
  constructor(
    private readonly searchIndexer: SearchIndexerService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Index a product after creation or update
   * Should be called from ProductsService after create/update operations
   */
  async indexProduct(productId: string): Promise<void> {
    try {
      await this.searchIndexer.indexProduct(productId);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "ProductsIndexingService.indexProduct",
          { productId },
        ),
        "Product queued for indexing",
      );
    } catch (error) {
      // Don't throw - indexing failures shouldn't break product operations
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ProductsIndexingService.indexProduct",
          error,
          { productId },
        ),
        "Failed to index product (non-blocking)",
      );
    }
  }

  /**
   * Index multiple products in batch
   */
  async indexProducts(productIds: string[]): Promise<void> {
    if (productIds.length === 0) {
      return;
    }

    try {
      await this.searchIndexer.indexProducts(productIds);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "ProductsIndexingService.indexProducts",
          { count: productIds.length },
        ),
        "Products queued for indexing",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ProductsIndexingService.indexProducts",
          error,
          { count: productIds.length },
        ),
        "Failed to index products (non-blocking)",
      );
    }
  }

  /**
   * Delete a product from the index
   * Should be called from ProductsService after delete operations
   */
  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.searchIndexer.deleteProduct(productId);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "ProductsIndexingService.deleteProduct",
          { productId },
        ),
        "Product queued for deletion from index",
      );
    } catch (error) {
      // Don't throw - indexing failures shouldn't break product operations
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ProductsIndexingService.deleteProduct",
          error,
          { productId },
        ),
        "Failed to delete product from index (non-blocking)",
      );
    }
  }
}
