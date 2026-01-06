import { Injectable, OnModuleInit } from "@nestjs/common";
import { MeiliSearch } from "meilisearch";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "../../../common/config/app.config.service";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import type {
  BatchIndexResult,
  IndexOptions,
  IndexSettings,
  IndexStats,
  SearchDocument,
  SearchQuery,
  SearchResponse,
} from "../types/search-provider.types";
import type { ISearchProvider } from "./search-provider.interface";

/**
 * Meilisearch provider implementation
 */
@Injectable()
export class MeilisearchProvider implements ISearchProvider, OnModuleInit {
  private client: MeiliSearch | null = null;
  private ready = false;

  constructor(
    private readonly configService: AppConfigService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    const config = this.configService.getMeilisearchConfig();

    if (!config.host) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "MeilisearchProvider.initialize",
          {},
        ),
        "Meilisearch host not configured, provider will be disabled. Set MEILISEARCH_HOST environment variable (e.g., http://localhost:7700)",
      );
      this.ready = false;
      return;
    }

    try {
      this.logger.debug(
        createLogContext(
          this.contextService,
          "MeilisearchProvider.initialize",
          { host: config.host, hasApiKey: !!config.apiKey },
        ),
        "Initializing Meilisearch provider",
      );

      this.client = new MeiliSearch({
        host: config.host,
        apiKey: config.apiKey,
      });

      // Test connection with timeout
      const healthCheckPromise = this.client.health();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Health check timed out after 5 seconds")),
          5000,
        ),
      );

      await Promise.race([healthCheckPromise, timeoutPromise]);
      this.ready = true;

      this.logger.info(
        createLogContext(
          this.contextService,
          "MeilisearchProvider.initialize",
          { host: config.host },
        ),
        "Meilisearch provider initialized successfully",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isConnectionError =
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("ENOTFOUND") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("timed out");

      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.initialize",
          error,
          {
            host: config.host,
            hasApiKey: !!config.apiKey,
            isConnectionError,
          },
        ),
        `Failed to initialize Meilisearch provider: ${errorMessage}. ${
          isConnectionError
            ? `Please ensure Meilisearch is running at ${config.host}. If running locally with Docker, use http://localhost:7700`
            : "Please check your Meilisearch configuration and ensure the service is accessible"
        }`,
      );
      this.ready = false;
      this.client = null;
    }
  }

  isReady(): boolean {
    return this.ready && this.client !== null;
  }

  /**
   * Retry initialization (useful if connection failed initially)
   */
  async retryInitialization(): Promise<void> {
    this.logger.info(
      createLogContext(
        this.contextService,
        "MeilisearchProvider.retryInitialization",
        {},
      ),
      "Retrying Meilisearch provider initialization",
    );
    await this.initialize();
  }

  private ensureReady(): void {
    if (!this.isReady()) {
      throw new Error("Meilisearch provider is not ready");
    }
  }

  async createIndex(indexName: string, options?: IndexOptions): Promise<void> {
    this.ensureReady();

    try {
      const _index = this.client?.index(indexName);

      // Create index if it doesn't exist
      if (!(await this.indexExists(indexName))) {
        await this.client?.createIndex(indexName);
      }

      // Update settings if provided
      if (options?.settings) {
        await this.updateIndexSettings(indexName, options.settings);
      }

      this.logger.debug(
        createLogContext(
          this.contextService,
          "MeilisearchProvider.createIndex",
          { indexName },
        ),
        "Index created successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.createIndex",
          error,
          { indexName },
        ),
        "Failed to create index",
      );
      throw error;
    }
  }

  async deleteIndex(indexName: string): Promise<void> {
    this.ensureReady();

    try {
      await this.client?.deleteIndex(indexName);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "MeilisearchProvider.deleteIndex",
          { indexName },
        ),
        "Index deleted successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.deleteIndex",
          error,
          { indexName },
        ),
        "Failed to delete index",
      );
      throw error;
    }
  }

  async indexExists(indexName: string): Promise<boolean> {
    this.ensureReady();

    try {
      const indexes = await this.client?.getIndexes();
      return indexes?.results.some((idx) => idx.uid === indexName) ?? false;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.indexExists",
          error,
          { indexName },
        ),
        "Failed to check if index exists",
      );
      return false;
    }
  }

  async getIndexStats(indexName: string): Promise<IndexStats> {
    this.ensureReady();

    try {
      const index = this.client?.index(indexName);
      if (!index) {
        throw new Error("Failed to get index");
      }
      const stats = await index.getStats();

      return {
        documentCount: stats.numberOfDocuments,
        indexSize: 0, // Meilisearch doesn't provide size directly
        lastIndexedAt: stats.isIndexing ? null : new Date().toISOString(), // Approximate
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.getIndexStats",
          error,
          { indexName },
        ),
        "Failed to get index stats",
      );
      throw error;
    }
  }

  async indexDocument(
    indexName: string,
    document: SearchDocument,
  ): Promise<void> {
    this.ensureReady();

    try {
      const index = this.client?.index(indexName);
      if (!index) {
        throw new Error("Failed to get index");
      }
      await index.addDocuments([document], { primaryKey: "id" });

      this.logger.debug(
        createLogContext(
          this.contextService,
          "MeilisearchProvider.indexDocument",
          { indexName, documentId: document.id },
        ),
        "Document indexed successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.indexDocument",
          error,
          { indexName, documentId: document.id },
        ),
        "Failed to index document",
      );
      throw error;
    }
  }

  async indexDocuments(
    indexName: string,
    documents: SearchDocument[],
  ): Promise<BatchIndexResult> {
    this.ensureReady();

    if (documents.length === 0) {
      return { success: 0, failed: 0 };
    }

    try {
      const index = this.client?.index(indexName);
      if (!index) {
        throw new Error("Failed to get index");
      }
      const task = await index.addDocuments(documents, { primaryKey: "id" });

      // Wait for task to complete
      await index.waitForTask(task.taskUid);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "MeilisearchProvider.indexDocuments",
          { indexName, count: documents.length },
        ),
        "Documents indexed successfully",
      );

      return {
        success: documents.length,
        failed: 0,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.indexDocuments",
          error,
          { indexName, count: documents.length },
        ),
        "Failed to index documents",
      );

      return {
        success: 0,
        failed: documents.length,
        errors: documents.map((doc) => ({
          id: doc.id,
          error: error instanceof Error ? error.message : "Unknown error",
        })),
      };
    }
  }

  async deleteDocument(indexName: string, documentId: string): Promise<void> {
    this.ensureReady();

    try {
      const index = this.client?.index(indexName);
      if (!index) {
        throw new Error("Failed to get index");
      }
      await index.deleteDocument(documentId);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "MeilisearchProvider.deleteDocument",
          { indexName, documentId },
        ),
        "Document deleted successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.deleteDocument",
          error,
          { indexName, documentId },
        ),
        "Failed to delete document",
      );
      throw error;
    }
  }

  async deleteDocuments(
    indexName: string,
    documentIds: string[],
  ): Promise<BatchIndexResult> {
    this.ensureReady();

    if (documentIds.length === 0) {
      return { success: 0, failed: 0 };
    }

    try {
      const index = this.client?.index(indexName);
      if (!index) {
        throw new Error("Failed to get index");
      }
      const task = await index.deleteDocuments(documentIds);
      await index.waitForTask(task.taskUid);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "MeilisearchProvider.deleteDocuments",
          { indexName, count: documentIds.length },
        ),
        "Documents deleted successfully",
      );

      return {
        success: documentIds.length,
        failed: 0,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.deleteDocuments",
          error,
          { indexName, count: documentIds.length },
        ),
        "Failed to delete documents",
      );

      return {
        success: 0,
        failed: documentIds.length,
        errors: documentIds.map((id) => ({
          id,
          error: error instanceof Error ? error.message : "Unknown error",
        })),
      };
    }
  }

  async clearIndex(indexName: string): Promise<void> {
    this.ensureReady();

    try {
      const index = this.client?.index(indexName);
      if (!index) {
        throw new Error("Failed to get index");
      }
      const task = await index.deleteAllDocuments();
      await index.waitForTask(task.taskUid);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "MeilisearchProvider.clearIndex",
          { indexName },
        ),
        "Index cleared successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.clearIndex",
          error,
          { indexName },
        ),
        "Failed to clear index",
      );
      throw error;
    }
  }

  async search<T extends SearchDocument = SearchDocument>(
    indexName: string,
    query: SearchQuery,
  ): Promise<SearchResponse<T>> {
    this.ensureReady();

    try {
      const index = this.client?.index(indexName);
      if (!index) {
        throw new Error("Failed to get index");
      }

      // Build Meilisearch search parameters
      const searchParams: {
        q?: string;
        filter?: string;
        sort?: string[];
        limit?: number;
        offset?: number;
        facets?: string[];
      } = {};

      if (query.query) {
        searchParams.q = query.query;
      }

      // Build filter string
      if (query.filters) {
        const filterParts: string[] = [];
        if (query.filters.categoryId) {
          filterParts.push(`categoryId = ${query.filters.categoryId}`);
        }
        if (query.filters.collectionId) {
          filterParts.push(`collections = ${query.filters.collectionId}`);
        }
        if (query.filters.minPrice !== undefined) {
          filterParts.push(`price >= ${query.filters.minPrice}`);
        }
        if (query.filters.maxPrice !== undefined) {
          filterParts.push(`price <= ${query.filters.maxPrice}`);
        }
        if (query.filters.inStock !== undefined) {
          // Check if any variant has inventory > 0
          filterParts.push(
            query.filters.inStock
              ? "variants.inventory > 0"
              : "variants.inventory <= 0",
          );
        }
        if (query.filters.status) {
          filterParts.push(`status = ${query.filters.status}`);
        }
        if (query.filters.tags && query.filters.tags.length > 0) {
          filterParts.push(
            `tags IN [${query.filters.tags.map((t) => `"${t}"`).join(", ")}]`,
          );
        }

        if (filterParts.length > 0) {
          searchParams.filter = filterParts.join(" AND ");
        }
      }

      // Build sort
      if (query.sort && query.sort.length > 0) {
        searchParams.sort = query.sort.map((s) => `${s.field}:${s.direction}`);
      }

      // Pagination
      const page = query.page || 1;
      const limit = query.limit || 20;
      searchParams.limit = limit;
      searchParams.offset = (page - 1) * limit;

      // Facets
      if (query.facets && query.facets.length > 0) {
        searchParams.facets = query.facets;
      }

      const result = await index.search<T>(searchParams.q || "", searchParams);

      // Transform Meilisearch response to our format
      const results = result.hits.map((hit) => ({
        document: hit as T,
        score: hit._rankingScore,
        highlights: hit._formatted
          ? Object.entries(hit._formatted).reduce(
              (acc, [key, value]) => {
                if (
                  typeof value === "string" &&
                  value !== hit[key as keyof T]
                ) {
                  acc[key] = [value];
                }
                return acc;
              },
              {} as Record<string, string[]>,
            )
          : undefined,
      }));

      const totalPages = Math.ceil((result.estimatedTotalHits || 0) / limit);

      return {
        results,
        total: result.estimatedTotalHits || 0,
        page,
        limit,
        totalPages,
        facets: result.facetDistribution
          ? Object.entries(result.facetDistribution).reduce(
              (acc, [key, values]) => {
                acc[key] = Object.entries(
                  values as Record<string, unknown>,
                ).map(([value, count]) => ({
                  value,
                  count: count as number,
                }));
                return acc;
              },
              {} as Record<string, Array<{ value: string; count: number }>>,
            )
          : undefined,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.search",
          error,
          { indexName, query },
        ),
        "Failed to search",
      );
      throw error;
    }
  }

  async updateIndexSettings(
    indexName: string,
    settings: IndexSettings,
  ): Promise<void> {
    this.ensureReady();

    try {
      const index = this.client?.index(indexName);
      if (!index) {
        throw new Error("Failed to get index");
      }

      const updateSettings: Record<string, unknown> = {};

      if (settings.searchableAttributes) {
        updateSettings.searchableAttributes = settings.searchableAttributes;
      }
      if (settings.filterableAttributes) {
        updateSettings.filterableAttributes = settings.filterableAttributes;
      }
      if (settings.sortableAttributes) {
        updateSettings.sortableAttributes = settings.sortableAttributes;
      }
      if (settings.rankingRules) {
        updateSettings.rankingRules = settings.rankingRules;
      }
      if (settings.synonyms) {
        updateSettings.synonyms = settings.synonyms;
      }
      if (settings.stopWords) {
        updateSettings.stopWords = settings.stopWords;
      }

      const task = await index.updateSettings(updateSettings);
      await index.waitForTask(task.taskUid);

      this.logger.debug(
        createLogContext(
          this.contextService,
          "MeilisearchProvider.updateIndexSettings",
          { indexName },
        ),
        "Index settings updated successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.updateIndexSettings",
          error,
          { indexName },
        ),
        "Failed to update index settings",
      );
      throw error;
    }
  }

  async getIndexSettings(indexName: string): Promise<IndexSettings> {
    this.ensureReady();

    try {
      const index = this.client?.index(indexName);
      if (!index) {
        throw new Error("Failed to get index");
      }
      const settings = await index.getSettings();

      return {
        searchableAttributes: settings.searchableAttributes as string[],
        filterableAttributes: settings.filterableAttributes as string[],
        sortableAttributes: settings.sortableAttributes as string[],
        rankingRules: settings.rankingRules as string[],
        synonyms: settings.synonyms as Record<string, string[]>,
        stopWords: settings.stopWords as string[],
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "MeilisearchProvider.getIndexSettings",
          error,
          { indexName },
        ),
        "Failed to get index settings",
      );
      throw error;
    }
  }
}
