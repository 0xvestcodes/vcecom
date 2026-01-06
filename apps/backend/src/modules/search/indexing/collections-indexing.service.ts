import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { SearchIndexerService } from "../search-indexer.service";

/**
 * Collections indexing service
 * Handles incremental indexing of collections when they are created, updated, or deleted
 */
@Injectable()
export class CollectionsIndexingService {
  constructor(
    private readonly searchIndexer: SearchIndexerService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Index a collection after creation or update
   * Should be called from CollectionsService after create/update operations
   */
  async indexCollection(collectionId: string): Promise<void> {
    try {
      await this.searchIndexer.indexCollection(collectionId);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "CollectionsIndexingService.indexCollection",
          { collectionId },
        ),
        "Collection queued for indexing",
      );
    } catch (error) {
      // Don't throw - indexing failures shouldn't break collection operations
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CollectionsIndexingService.indexCollection",
          error,
          { collectionId },
        ),
        "Failed to index collection (non-blocking)",
      );
    }
  }

  /**
   * Index multiple collections in batch
   */
  async indexCollections(collectionIds: string[]): Promise<void> {
    if (collectionIds.length === 0) {
      return;
    }

    try {
      await this.searchIndexer.indexCollections(collectionIds);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "CollectionsIndexingService.indexCollections",
          { count: collectionIds.length },
        ),
        "Collections queued for indexing",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CollectionsIndexingService.indexCollections",
          error,
          { count: collectionIds.length },
        ),
        "Failed to index collections (non-blocking)",
      );
    }
  }

  /**
   * Delete a collection from the index
   * Should be called from CollectionsService after delete operations
   */
  async deleteCollection(collectionId: string): Promise<void> {
    try {
      await this.searchIndexer.deleteCollection(collectionId);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "CollectionsIndexingService.deleteCollection",
          { collectionId },
        ),
        "Collection queued for deletion from index",
      );
    } catch (error) {
      // Don't throw - indexing failures shouldn't break collection operations
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CollectionsIndexingService.deleteCollection",
          error,
          { collectionId },
        ),
        "Failed to delete collection from index (non-blocking)",
      );
    }
  }

  /**
   * Reindex all products in a collection when collection changes
   * This ensures product documents have updated collection information
   */
  async reindexCollectionProducts(collectionId: string): Promise<void> {
    try {
      // This will be called after collection updates to ensure products reflect collection changes
      // The actual product reindexing will be handled by the reindex worker if needed
      this.logger.debug(
        createLogContext(
          this.contextService,
          "CollectionsIndexingService.reindexCollectionProducts",
          { collectionId },
        ),
        "Collection products may need reindexing",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CollectionsIndexingService.reindexCollectionProducts",
          error,
          { collectionId },
        ),
        "Failed to trigger product reindexing for collection (non-blocking)",
      );
    }
  }
}
