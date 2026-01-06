import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { collections, products } from "@vcecom/db";
import { eq } from "drizzle-orm";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "../../../common/config/app.config.service";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../database/database.module";
import type { Database } from "../../database/db";
import { SearchIndexerService } from "../search-indexer.service";

/**
 * Service for hydrating search indexes on application startup
 * Indexes all active products and collections into search provider (Meilisearch/Elasticsearch/OpenSearch)
 */
@Injectable()
export class SearchCacheHydrationService implements OnModuleInit {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly searchIndexer: SearchIndexerService,
    private readonly configService: AppConfigService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Hydrate search indexes on module initialization
   * Runs in background to avoid blocking app startup
   * Delayed by 12 seconds to serialize with other warmups
   */
  async onModuleInit(): Promise<void> {
    // Only run if search indexing is enabled
    if (!this.configService.getSearchConfig().indexingEnabled) {
      this.logger.info(
        createLogContext(this.contextService, "onModuleInit", {}),
        "Search indexing is disabled, skipping search cache hydration",
      );
      return;
    }

    this.logger.info(
      createLogContext(this.contextService, "onModuleInit", {}),
      "Starting search cache hydration in background (delayed 12s to serialize with other warmups)",
    );
    // Delay hydration to serialize with other warmups and prevent connection pool saturation
    setTimeout(() => {
      // Run hydration in background - don't block startup
      this.hydrate()
        .then(() => {
          this.logger.info(
            createLogContext(this.contextService, "onModuleInit", {}),
            "Search cache hydration completed successfully",
          );
        })
        .catch((error) => {
          // Don't block startup if hydration fails
          this.logger.error(
            createErrorContext(this.contextService, "onModuleInit", error),
            "Failed to hydrate search cache on startup - will retry later",
          );
          this.logger.warn(
            createLogContext(this.contextService, "onModuleInit", {}),
            "Continuing startup without search cache hydration, search will fallback to DB queries",
          );
        });
    }, 12000); // 12 second delay to serialize with other warmups
  }

  /**
   * Hydrate all search indexes
   */
  async hydrate(): Promise<void> {
    if (!this.configService.getSearchConfig().indexingEnabled) {
      return;
    }

    this.logger.info(
      createLogContext(this.contextService, "hydrate", {}),
      "Hydrating search indexes",
    );

    try {
      // Index all active products
      const allProducts = await this.db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.status, "active"));

      if (allProducts.length > 0) {
        const productIds = allProducts.map((p) => p.id);
        this.logger.info(
          createLogContext(this.contextService, "hydrate", {
            productCount: productIds.length,
          }),
          "Indexing products into search",
        );

        const batchSize = this.configService.getSearchConfig().batchSize;
        // Process in batches to avoid overwhelming the system
        for (let i = 0; i < productIds.length; i += batchSize) {
          const batch = productIds.slice(i, i + batchSize);
          try {
            await this.searchIndexer.indexProducts(batch);
            this.logger.debug(
              createLogContext(this.contextService, "hydrate", {
                batchStart: i,
                batchSize: batch.length,
                total: productIds.length,
              }),
              "Indexed batch of products",
            );
          } catch (error) {
            this.logger.warn(
              createErrorContext(this.contextService, "hydrate", error, {
                batchStart: i,
                batchSize: batch.length,
              }),
              "Failed to index batch of products, continuing with next batch",
            );
          }
        }

        this.logger.info(
          createLogContext(this.contextService, "hydrate", {
            productCount: productIds.length,
          }),
          "Products indexed successfully",
        );
      } else {
        this.logger.info(
          createLogContext(this.contextService, "hydrate", {}),
          "No active products found, skipping product indexing",
        );
      }

      // Index all collections
      const allCollections = await this.db
        .select({ id: collections.id })
        .from(collections);

      if (allCollections.length > 0) {
        const collectionIds = allCollections.map((c) => c.id);
        this.logger.info(
          createLogContext(this.contextService, "hydrate", {
            collectionCount: collectionIds.length,
          }),
          "Indexing collections into search",
        );

        const batchSize = this.configService.getSearchConfig().batchSize;
        // Process in batches
        for (let i = 0; i < collectionIds.length; i += batchSize) {
          const batch = collectionIds.slice(i, i + batchSize);
          try {
            await this.searchIndexer.indexCollections(batch);
            this.logger.debug(
              createLogContext(this.contextService, "hydrate", {
                batchStart: i,
                batchSize: batch.length,
                total: collectionIds.length,
              }),
              "Indexed batch of collections",
            );
          } catch (error) {
            this.logger.warn(
              createErrorContext(this.contextService, "hydrate", error, {
                batchStart: i,
                batchSize: batch.length,
              }),
              "Failed to index batch of collections, continuing with next batch",
            );
          }
        }

        this.logger.info(
          createLogContext(this.contextService, "hydrate", {
            collectionCount: collectionIds.length,
          }),
          "Collections indexed successfully",
        );
      } else {
        this.logger.info(
          createLogContext(this.contextService, "hydrate", {}),
          "No collections found, skipping collection indexing",
        );
      }

      this.logger.info(
        createLogContext(this.contextService, "hydrate", {}),
        "Search cache hydration completed",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "hydrate", error),
        "Failed to hydrate search cache",
      );
      throw error;
    }
  }
}
