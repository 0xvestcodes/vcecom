import { Injectable, OnModuleInit } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
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
 * OpenSearch provider implementation
 */
@Injectable()
export class OpenSearchProvider implements ISearchProvider, OnModuleInit {
  private client: Client | null = null;
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
    const config = this.configService.getOpenSearchConfig();

    if (!config.host) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "OpenSearchProvider.initialize",
          {},
        ),
        "OpenSearch host not configured, provider will be disabled",
      );
      this.ready = false;
      return;
    }

    try {
      const clientOptions: {
        node: string;
        auth?: { username: string; password: string };
        headers?: Record<string, string>;
      } = {
        node: config.host,
      };

      if (config.apiKey) {
        // OpenSearch API keys are passed via headers, not auth property
        clientOptions.headers = {
          Authorization: config.apiKey.startsWith("ApiKey ")
            ? config.apiKey
            : `ApiKey ${config.apiKey}`,
        };
      } else if (config.username && config.password) {
        clientOptions.auth = {
          username: config.username,
          password: config.password,
        };
      }

      this.client = new Client(clientOptions);

      // Test connection
      await this.client.ping();
      this.ready = true;

      this.logger.info(
        createLogContext(this.contextService, "OpenSearchProvider.initialize", {
          host: config.host,
        }),
        "OpenSearch provider initialized successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.initialize",
          error,
        ),
        "Failed to initialize OpenSearch provider",
      );
      this.ready = false;
    }
  }

  isReady(): boolean {
    return this.ready && this.client !== null;
  }

  private ensureReady(): void {
    if (!this.isReady()) {
      throw new Error("OpenSearch provider is not ready");
    }
  }

  async createIndex(indexName: string, options?: IndexOptions): Promise<void> {
    this.ensureReady();

    try {
      const exists = await this.indexExists(indexName);
      if (!exists) {
        const body: Record<string, unknown> = {};

        if (options?.settings) {
          body.settings = this.convertSettingsToOpenSearch(options.settings);
        }

        await this.client?.indices.create({
          index: indexName,
          body,
        });
      } else if (options?.settings) {
        await this.updateIndexSettings(indexName, options.settings);
      }

      this.logger.debug(
        createLogContext(
          this.contextService,
          "OpenSearchProvider.createIndex",
          { indexName },
        ),
        "Index created successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.createIndex",
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
      await this.client?.indices.delete({ index: indexName });

      this.logger.debug(
        createLogContext(
          this.contextService,
          "OpenSearchProvider.deleteIndex",
          { indexName },
        ),
        "Index deleted successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.deleteIndex",
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
      const response = await this.client?.indices.exists({ index: indexName });
      return (response?.body as boolean) ?? false;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.indexExists",
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
      const stats = await this.client?.indices.stats({ index: indexName });
      if (!stats) {
        throw new Error("Failed to get index stats");
      }
      const indexStats = stats.body.indices?.[indexName];

      return {
        documentCount: indexStats?.total?.docs?.count || 0,
        indexSize: indexStats?.total?.store?.size_in_bytes || 0,
        lastIndexedAt: null, // OpenSearch doesn't provide this directly
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.getIndexStats",
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
      await this.client?.index({
        index: indexName,
        id: document.id,
        body: document,
      });

      this.logger.debug(
        createLogContext(
          this.contextService,
          "OpenSearchProvider.indexDocument",
          { indexName, documentId: document.id },
        ),
        "Document indexed successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.indexDocument",
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
      const body = documents.flatMap((doc) => [
        { index: { _index: indexName, _id: doc.id } },
        doc,
      ]);

      const response = await this.client?.bulk({ body });

      const errors: Array<{ id: string; error: string }> = [];
      let successCount = 0;
      let failedCount = 0;

      if (response?.body.items) {
        for (const item of response.body.items) {
          if ("index" in item) {
            if (item.index?.error) {
              failedCount++;
              errors.push({
                id: item.index._id || "unknown",
                error: JSON.stringify(item.index.error),
              });
            } else {
              successCount++;
            }
          }
        }
      }

      this.logger.debug(
        createLogContext(
          this.contextService,
          "OpenSearchProvider.indexDocuments",
          { indexName, success: successCount, failed: failedCount },
        ),
        "Documents indexed",
      );

      return {
        success: successCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.indexDocuments",
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
      await this.client?.delete({ index: indexName, id: documentId });

      this.logger.debug(
        createLogContext(
          this.contextService,
          "OpenSearchProvider.deleteDocument",
          { indexName, documentId },
        ),
        "Document deleted successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.deleteDocument",
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
      const body = documentIds.map((id) => ({
        delete: { _index: indexName, _id: id },
      }));

      const response = await this.client?.bulk({ body });

      const errors: Array<{ id: string; error: string }> = [];
      let successCount = 0;
      let failedCount = 0;

      if (response?.body.items) {
        for (const item of response.body.items) {
          if ("delete" in item) {
            if (item.delete?.error) {
              failedCount++;
              errors.push({
                id: item.delete._id || "unknown",
                error: JSON.stringify(item.delete.error),
              });
            } else {
              successCount++;
            }
          }
        }
      }

      this.logger.debug(
        createLogContext(
          this.contextService,
          "OpenSearchProvider.deleteDocuments",
          { indexName, success: successCount, failed: failedCount },
        ),
        "Documents deleted",
      );

      return {
        success: successCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.deleteDocuments",
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
      await this.client?.deleteByQuery({
        index: indexName,
        body: {
          query: {
            match_all: {},
          },
        },
      });

      this.logger.debug(
        createLogContext(this.contextService, "OpenSearchProvider.clearIndex", {
          indexName,
        }),
        "Index cleared successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.clearIndex",
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
      const page = query.page || 1;
      const limit = query.limit || 20;
      const from = (page - 1) * limit;

      const body: Record<string, unknown> = {
        from,
        size: limit,
      };

      // Build query
      const must: unknown[] = [];
      const filter: unknown[] = [];

      if (query.query) {
        must.push({
          multi_match: {
            query: query.query,
            fields: ["title^2", "description", "tags", "collectionNames"],
            type: "best_fields",
            fuzziness: "AUTO",
          },
        });
      } else {
        must.push({ match_all: {} });
      }

      // Build filters
      if (query.filters) {
        if (query.filters.categoryId) {
          filter.push({ term: { categoryId: query.filters.categoryId } });
        }
        if (query.filters.collectionId) {
          filter.push({ term: { collections: query.filters.collectionId } });
        }
        if (query.filters.minPrice !== undefined) {
          filter.push({ range: { price: { gte: query.filters.minPrice } } });
        }
        if (query.filters.maxPrice !== undefined) {
          filter.push({ range: { price: { lte: query.filters.maxPrice } } });
        }
        if (query.filters.inStock !== undefined) {
          filter.push({
            range: {
              "variants.inventory": {
                [query.filters.inStock ? "gt" : "lte"]: 0,
              },
            },
          });
        }
        if (query.filters.status) {
          filter.push({ term: { status: query.filters.status } });
        }
        if (query.filters.tags && query.filters.tags.length > 0) {
          filter.push({ terms: { tags: query.filters.tags } });
        }
      }

      body.query = {
        bool: {
          must,
          filter,
        },
      };

      // Build sort
      if (query.sort && query.sort.length > 0) {
        body.sort = query.sort.map((s) => ({
          [s.field]: { order: s.direction },
        }));
      } else {
        // Default sort by relevance
        body.sort = ["_score"];
      }

      // Facets
      if (query.facets && query.facets.length > 0) {
        body.aggs = query.facets.reduce(
          (acc, facet) => {
            acc[facet] = { terms: { field: facet, size: 10 } };
            return acc;
          },
          {} as Record<string, unknown>,
        );
      }

      const response = await this.client?.search({
        index: indexName,
        body,
      });

      if (!response) {
        throw new Error("Search request failed");
      }

      const hits = response.body.hits?.hits || [];
      const results = hits.map(
        (hit: {
          _source: T;
          _score?: number;
          highlight?: Record<string, string[]>;
        }) => ({
          document: hit._source as T,
          score: hit._score,
          highlights: hit.highlight
            ? Object.entries(hit.highlight).reduce(
                (acc: Record<string, string[]>, [key, values]) => {
                  acc[key] = values as string[];
                  return acc;
                },
                {},
              )
            : undefined,
        }),
      );

      const total = response.body.hits?.total
        ? typeof response.body.hits.total === "number"
          ? response.body.hits.total
          : response.body.hits.total.value
        : 0;

      const totalPages = Math.ceil(total / limit);

      // Extract facets
      const facets: Record<
        string,
        Array<{ value: string; count: number }>
      > = {};
      if (response.body.aggregations) {
        for (const [key, agg] of Object.entries(response.body.aggregations)) {
          const typedAgg = agg as {
            buckets?: Array<{ key: string; doc_count: number }>;
          };
          if ("buckets" in typedAgg && Array.isArray(typedAgg.buckets)) {
            facets[key] = typedAgg.buckets.map(
              (bucket: { key: string; doc_count: number }) => ({
                value: bucket.key,
                count: bucket.doc_count,
              }),
            );
          }
        }
      }

      return {
        results,
        total,
        page,
        limit,
        totalPages,
        facets: Object.keys(facets).length > 0 ? facets : undefined,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.search",
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
      const body: Record<string, unknown> = {};

      if (settings.searchableAttributes || settings.filterableAttributes) {
        body.properties = {};
        const allFields = [
          ...(settings.searchableAttributes || []),
          ...(settings.filterableAttributes || []),
        ];

        // Set up field mappings (simplified)
        for (const field of allFields) {
          (body.properties as Record<string, unknown>)[field] = {
            type: "text",
            fields: {
              keyword: {
                type: "keyword",
              },
            },
          };
        }
      }

      await this.client?.indices.putMapping({
        index: indexName,
        body,
      });

      this.logger.debug(
        createLogContext(
          this.contextService,
          "OpenSearchProvider.updateIndexSettings",
          { indexName },
        ),
        "Index settings updated successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.updateIndexSettings",
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
      const mapping = await this.client?.indices.getMapping({
        index: indexName,
      });

      if (!mapping) {
        throw new Error("Failed to get index mapping");
      }

      const indexMapping = mapping.body[indexName];
      const properties = indexMapping?.mappings?.properties || {};

      return {
        searchableAttributes: Object.keys(properties),
        filterableAttributes: Object.keys(properties),
        sortableAttributes: Object.keys(properties),
        rankingRules: [],
        synonyms: {},
        stopWords: [],
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OpenSearchProvider.getIndexSettings",
          error,
          { indexName },
        ),
        "Failed to get index settings",
      );
      throw error;
    }
  }

  private convertSettingsToOpenSearch(
    settings: IndexSettings,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (settings.searchableAttributes || settings.filterableAttributes) {
      result.mappings = {
        properties: {},
      };

      const allFields = [
        ...(settings.searchableAttributes || []),
        ...(settings.filterableAttributes || []),
      ];

      for (const field of allFields) {
        (result.mappings as { properties: Record<string, unknown> }).properties[
          field
        ] = {
          type: "text",
          fields: {
            keyword: {
              type: "keyword",
            },
          },
        };
      }
    }

    return result;
  }
}
