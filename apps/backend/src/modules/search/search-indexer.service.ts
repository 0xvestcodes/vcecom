import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  categories,
  collections,
  eq,
  isNull,
  productCollections,
  productImages,
  products,
  productTags,
  productVariants,
  tags,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "../../common/config/app.config.service";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { DB_TOKEN } from "../database/database.module";
import type { Database } from "../database/db";
import { StorageService } from "../storage/storage.service";
import { ElasticsearchProvider } from "./providers/elasticsearch.provider";
import { MeilisearchProvider } from "./providers/meilisearch.provider";
import { OpenSearchProvider } from "./providers/opensearch.provider";
import type { ISearchProvider } from "./providers/search-provider.interface";
import type {
  CollectionSearchDocument,
  ProductSearchDocument,
} from "./types/search-document.types";
import type {
  BatchIndexResult,
  IndexOptions,
  IndexStats,
} from "./types/search-provider.types";

/**
 * Search indexer service
 * Handles document transformation and indexing operations
 */
@Injectable()
export class SearchIndexerService {
  private provider: ISearchProvider | null = null;
  private readonly PRODUCTS_INDEX = "products";
  private readonly COLLECTIONS_INDEX = "collections";

  constructor(
    private readonly configService: AppConfigService,
    private readonly meilisearchProvider: MeilisearchProvider,
    private readonly elasticsearchProvider: ElasticsearchProvider,
    private readonly opensearchProvider: OpenSearchProvider,
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    const searchConfig = this.configService.getSearchConfig();

    switch (searchConfig.provider) {
      case "meilisearch":
        this.provider = this.meilisearchProvider;
        break;
      case "elasticsearch":
        this.provider = this.elasticsearchProvider;
        break;
      case "opensearch":
        this.provider = this.opensearchProvider;
        break;
      default:
        this.logger.warn(
          createLogContext(
            this.contextService,
            "SearchIndexerService.initializeProvider",
            { provider: searchConfig.provider },
          ),
          "Unknown search provider, indexing will be disabled",
        );
    }
  }

  private ensureProvider(): void {
    if (!this.provider || !this.provider.isReady()) {
      throw new Error("Search provider is not ready");
    }
  }

  /**
   * Initialize indexes with default settings
   */
  async initializeIndexes(): Promise<void> {
    if (!this.configService.getSearchConfig().indexingEnabled) {
      this.logger.debug(
        createLogContext(
          this.contextService,
          "SearchIndexerService.initializeIndexes",
          {},
        ),
        "Indexing is disabled, skipping index initialization",
      );
      return;
    }

    this.ensureProvider();

    try {
      // Products index settings
      const productsIndexOptions: IndexOptions = {
        settings: {
          searchableAttributes: [
            "title",
            "description",
            "tags",
            "collectionNames",
            "variants.sku",
          ],
          filterableAttributes: [
            "status",
            "categoryId",
            "collections",
            "price",
            "tags",
            "isDigital",
            "isPreorder",
          ],
          sortableAttributes: ["price", "createdAt", "updatedAt"],
          rankingRules: [
            "words",
            "typo",
            "proximity",
            "attribute",
            "sort",
            "exactness",
          ],
        },
      };

      // Collections index settings
      const collectionsIndexOptions: IndexOptions = {
        settings: {
          searchableAttributes: ["name", "description"],
          filterableAttributes: ["type"],
          sortableAttributes: ["name", "createdAt", "updatedAt"],
          rankingRules: ["words", "typo", "proximity", "attribute", "sort"],
        },
      };

      if (!this.provider) {
        throw new Error("Search provider is not initialized");
      }
      await this.provider.createIndex(
        this.PRODUCTS_INDEX,
        productsIndexOptions,
      );
      await this.provider.createIndex(
        this.COLLECTIONS_INDEX,
        collectionsIndexOptions,
      );

      this.logger.info(
        createLogContext(
          this.contextService,
          "SearchIndexerService.initializeIndexes",
          {},
        ),
        "Search indexes initialized successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchIndexerService.initializeIndexes",
          error,
        ),
        "Failed to initialize search indexes",
      );
      throw error;
    }
  }

  /**
   * Transform a product to a search document
   */
  async transformProductToDocument(
    productId: string,
  ): Promise<ProductSearchDocument | null> {
    try {
      // Fetch product
      const [product] = await this.db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!product) {
        return null;
      }

      // Fetch category
      let categoryName: string | null = null;
      if (product.categoryId) {
        const [category] = await this.db
          .select({ name: categories.name })
          .from(categories)
          .where(eq(categories.id, product.categoryId))
          .limit(1);
        categoryName = category?.name || null;
      }

      // Fetch variants
      const variants = await this.db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, productId));

      const variantDocuments = variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        price: Number(v.price),
        compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
        inventory: v.inventory,
        size: v.size,
        color: v.color,
        weight: v.weight ? Number(v.weight) : null,
      }));

      // Fetch collections
      const productCollectionRelations = await this.db
        .select({
          collectionId: productCollections.collectionId,
          collectionName: collections.name,
        })
        .from(productCollections)
        .innerJoin(
          collections,
          eq(productCollections.collectionId, collections.id),
        )
        .where(eq(productCollections.productId, productId));

      const collectionIds = productCollectionRelations.map(
        (r) => r.collectionId,
      );
      const collectionNames = productCollectionRelations.map(
        (r) => r.collectionName,
      );

      // Fetch tags
      const productTagRelations = await this.db
        .select({ tagName: tags.name })
        .from(productTags)
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(eq(productTags.productId, productId));

      const tagNames = productTagRelations.map((r) => r.tagName);

      // Fetch first product image
      const [firstImage] = await this.db
        .select({ url: productImages.url })
        .from(productImages)
        .where(
          and(
            eq(productImages.productId, productId),
            isNull(productImages.variantId),
          ),
        )
        .orderBy(asc(productImages.order))
        .limit(1);

      let imageUrl: string | null = null;
      if (firstImage?.url) {
        // Resolve S3 key to URL if needed
        if (this.isS3Key(firstImage.url)) {
          try {
            imageUrl = await this.storageService.getUrl(firstImage.url);
          } catch {
            imageUrl = firstImage.url;
          }
        } else {
          imageUrl = firstImage.url;
        }
      }

      return {
        id: product.id,
        entityType: "product",
        indexedAt: new Date().toISOString(),
        title: product.title,
        description: product.description,
        slug: product.slug,
        price: Number(product.price),
        status: product.status,
        categoryId: product.categoryId,
        categoryName,
        hsnCode: product.hsnCode,
        tags: tagNames,
        collections: collectionIds,
        collectionNames,
        variants: variantDocuments,
        imageUrl,
        isDigital: product.isDigital,
        isPreorder: product.isPreorder,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchIndexerService.transformProductToDocument",
          error,
          { productId },
        ),
        "Failed to transform product to search document",
      );
      throw error;
    }
  }

  /**
   * Transform a collection to a search document
   */
  async transformCollectionToDocument(
    collectionId: string,
  ): Promise<CollectionSearchDocument | null> {
    try {
      // Fetch collection
      const [collection] = await this.db
        .select()
        .from(collections)
        .where(eq(collections.id, collectionId))
        .limit(1);

      if (!collection) {
        return null;
      }

      // Count products in collection
      const productCountResult = await this.db
        .select({ count: productCollections.id })
        .from(productCollections)
        .where(eq(productCollections.collectionId, collectionId));

      return {
        id: collection.id,
        entityType: "collection",
        indexedAt: new Date().toISOString(),
        name: collection.name,
        slug: collection.slug,
        description: collection.description,
        imageUrl: collection.imageUrl,
        type: collection.type,
        productCount: productCountResult.length,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchIndexerService.transformCollectionToDocument",
          error,
          { collectionId },
        ),
        "Failed to transform collection to search document",
      );
      throw error;
    }
  }

  /**
   * Index a single product
   */
  async indexProduct(productId: string): Promise<void> {
    if (!this.configService.getSearchConfig().indexingEnabled) {
      return;
    }

    this.ensureProvider();

    try {
      const document = await this.transformProductToDocument(productId);
      if (!document) {
        this.logger.warn(
          createLogContext(
            this.contextService,
            "SearchIndexerService.indexProduct",
            { productId },
          ),
          "Product not found, skipping indexing",
        );
        return;
      }

      await this.provider?.indexDocument(this.PRODUCTS_INDEX, document);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "SearchIndexerService.indexProduct",
          { productId },
        ),
        "Product indexed successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchIndexerService.indexProduct",
          error,
          { productId },
        ),
        "Failed to index product",
      );
      throw error;
    }
  }

  /**
   * Index multiple products in batch
   */
  async indexProducts(productIds: string[]): Promise<BatchIndexResult> {
    if (!this.configService.getSearchConfig().indexingEnabled) {
      return { success: 0, failed: 0 };
    }

    this.ensureProvider();

    if (productIds.length === 0) {
      return { success: 0, failed: 0 };
    }

    try {
      const batchSize = this.configService.getSearchConfig().batchSize;
      const documents: ProductSearchDocument[] = [];

      // Process in batches to avoid memory issues
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const batchDocuments = await Promise.all(
          batch.map((id) => this.transformProductToDocument(id)),
        );
        documents.push(
          ...(batchDocuments.filter(
            (doc) => doc !== null,
          ) as ProductSearchDocument[]),
        );
      }

      if (documents.length === 0) {
        return { success: 0, failed: productIds.length };
      }

      const result = await this.provider?.indexDocuments(
        this.PRODUCTS_INDEX,
        documents,
      );

      if (!result) {
        throw new Error("Failed to index products");
      }

      this.logger.debug(
        createLogContext(
          this.contextService,
          "SearchIndexerService.indexProducts",
          {
            count: productIds.length,
            success: result.success,
            failed: result.failed,
          },
        ),
        "Products indexed",
      );

      return result;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchIndexerService.indexProducts",
          error,
          { count: productIds.length },
        ),
        "Failed to index products",
      );
      throw error;
    }
  }

  /**
   * Index a single collection
   */
  async indexCollection(collectionId: string): Promise<void> {
    if (!this.configService.getSearchConfig().indexingEnabled) {
      return;
    }

    this.ensureProvider();

    try {
      const document = await this.transformCollectionToDocument(collectionId);
      if (!document) {
        this.logger.warn(
          createLogContext(
            this.contextService,
            "SearchIndexerService.indexCollection",
            { collectionId },
          ),
          "Collection not found, skipping indexing",
        );
        return;
      }

      await this.provider?.indexDocument(this.COLLECTIONS_INDEX, document);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "SearchIndexerService.indexCollection",
          { collectionId },
        ),
        "Collection indexed successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchIndexerService.indexCollection",
          error,
          { collectionId },
        ),
        "Failed to index collection",
      );
      throw error;
    }
  }

  /**
   * Index multiple collections in batch
   */
  async indexCollections(collectionIds: string[]): Promise<BatchIndexResult> {
    if (!this.configService.getSearchConfig().indexingEnabled) {
      return { success: 0, failed: 0 };
    }

    this.ensureProvider();

    if (collectionIds.length === 0) {
      return { success: 0, failed: 0 };
    }

    try {
      const documents = await Promise.all(
        collectionIds.map((id) => this.transformCollectionToDocument(id)),
      );

      const validDocuments = documents.filter(
        (doc) => doc !== null,
      ) as CollectionSearchDocument[];

      if (validDocuments.length === 0) {
        return { success: 0, failed: collectionIds.length };
      }

      const result = await this.provider?.indexDocuments(
        this.COLLECTIONS_INDEX,
        validDocuments,
      );

      if (!result) {
        throw new Error("Failed to index collections");
      }

      this.logger.debug(
        createLogContext(
          this.contextService,
          "SearchIndexerService.indexCollections",
          {
            count: collectionIds.length,
            success: result.success,
            failed: result.failed,
          },
        ),
        "Collections indexed",
      );

      return result;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchIndexerService.indexCollections",
          error,
          { count: collectionIds.length },
        ),
        "Failed to index collections",
      );
      throw error;
    }
  }

  /**
   * Delete a product from the index
   */
  async deleteProduct(productId: string): Promise<void> {
    if (!this.configService.getSearchConfig().indexingEnabled) {
      return;
    }

    this.ensureProvider();

    try {
      await this.provider?.deleteDocument(this.PRODUCTS_INDEX, productId);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "SearchIndexerService.deleteProduct",
          { productId },
        ),
        "Product deleted from index",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchIndexerService.deleteProduct",
          error,
          { productId },
        ),
        "Failed to delete product from index",
      );
      throw error;
    }
  }

  /**
   * Delete a collection from the index
   */
  async deleteCollection(collectionId: string): Promise<void> {
    if (!this.configService.getSearchConfig().indexingEnabled) {
      return;
    }

    this.ensureProvider();

    try {
      await this.provider?.deleteDocument(this.COLLECTIONS_INDEX, collectionId);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "SearchIndexerService.deleteCollection",
          { collectionId },
        ),
        "Collection deleted from index",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchIndexerService.deleteCollection",
          error,
          { collectionId },
        ),
        "Failed to delete collection from index",
      );
      throw error;
    }
  }

  /**
   * Clear all products from index
   */
  async clearProductsIndex(): Promise<void> {
    this.ensureProvider();

    try {
      await this.provider?.clearIndex(this.PRODUCTS_INDEX);

      this.logger.info(
        createLogContext(
          this.contextService,
          "SearchIndexerService.clearProductsIndex",
          {},
        ),
        "Products index cleared",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchIndexerService.clearProductsIndex",
          error,
        ),
        "Failed to clear products index",
      );
      throw error;
    }
  }

  /**
   * Clear all collections from index
   */
  async clearCollectionsIndex(): Promise<void> {
    this.ensureProvider();

    try {
      await this.provider?.clearIndex(this.COLLECTIONS_INDEX);

      this.logger.info(
        createLogContext(
          this.contextService,
          "SearchIndexerService.clearCollectionsIndex",
          {},
        ),
        "Collections index cleared",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchIndexerService.clearCollectionsIndex",
          error,
        ),
        "Failed to clear collections index",
      );
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<{
    products: IndexStats;
    collections: IndexStats;
  }> {
    this.ensureProvider();

    try {
      const [productsStats, collectionsStats] = await Promise.all([
        this.provider?.getIndexStats(this.PRODUCTS_INDEX),
        this.provider?.getIndexStats(this.COLLECTIONS_INDEX),
      ]);

      if (!productsStats || !collectionsStats) {
        throw new Error("Failed to get index stats");
      }

      return {
        products: productsStats,
        collections: collectionsStats,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchIndexerService.getIndexStats",
          error,
        ),
        "Failed to get index stats",
      );
      throw error;
    }
  }

  /**
   * Check if a string is an S3 key (not a full URL)
   */
  private isS3Key(url: string): boolean {
    return !url.startsWith("http://") && !url.startsWith("https://");
  }
}
