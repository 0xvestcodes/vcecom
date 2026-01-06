import { Client } from "@elastic/elasticsearch";
import { Injectable, OnModuleInit } from "@nestjs/common";
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
 * Elasticsearch provider implementation
 */
@Injectable()
export class ElasticsearchProvider implements ISearchProvider, OnModuleInit {
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
    const config = this.configService.getElasticsearchConfig();

    if (!config.host) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "ElasticsearchProvider.initialize",
          {},
        ),
        "Elasticsearch host not configured, provider will be disabled",
      );
      this.ready = false;
      return;
    }

    try {
      const clientOptions: {
        node: string;
        auth?: { apiKey: string } | { username: string; password: string };
      } = {
        node: config.host,
      };

      if (config.apiKey) {
        clientOptions.auth = { apiKey: config.apiKey };
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
        createLogContext(
          this.contextService,
          "ElasticsearchProvider.initialize",
          { host: config.host },
        ),
        "Elasticsearch provider initialized successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ElasticsearchProvider.initialize",
          error,
        ),
        "Failed to initialize Elasticsearch provider",
      );
      this.ready = false;
    }
  }

  isReady(): boolean {
    return this.ready && this.client !== null;
  }

  private ensureReady(): void {
    if (!this.isReady()) {
      throw new Error("Elasticsearch provider is not ready");
    }
  }

  async createIndex(indexName: string, options?: IndexOptions): Promise<void> {
    this.ensureReady();

    try {
      const exists = await this.indexExists(indexName);
      if (!exists) {
        const body: Record<string, unknown> = {};

        if (options?.settings) {
          body.settings = this.convertSettingsToElasticsearch(options.settings);
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
          "ElasticsearchProvider.createIndex",
          { indexName },
        ),
        "Index created successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ElasticsearchProvider.createIndex",
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
          "ElasticsearchProvider.deleteIndex",
          { indexName },
        ),
        "Index deleted successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ElasticsearchProvider.deleteIndex",
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
      return response ?? false;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ElasticsearchProvider.indexExists",
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
      const indexStats = stats.indices?.[indexName];

      return {
        documentCount: indexStats?.total?.docs?.count || 0,
        indexSize: indexStats?.total?.store?.size_in_bytes || 0,
        lastIndexedAt: null, // Elasticsearch doesn't provide this directly
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ElasticsearchProvider.getIndexStats",
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
        document,
      });

      this.logger.debug(
        createLogContext(
          this.contextService,
          "ElasticsearchProvider.indexDocument",
          { indexName, documentId: document.id },
        ),
        "Document indexed successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ElasticsearchProvider.indexDocument",
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

      if (response?.items) {
        for (const item of response.items) {
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
          "ElasticsearchProvider.indexDocuments",
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
          "ElasticsearchProvider.indexDocuments",
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
          "ElasticsearchProvider.deleteDocument",
          { indexName, documentId },
        ),
        "Document deleted successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ElasticsearchProvider.deleteDocument",
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

      if (response?.items) {
        for (const item of response.items) {
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
          "ElasticsearchProvider.deleteDocuments",
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
          "ElasticsearchProvider.deleteDocuments",
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
        createLogContext(
          this.contextService,
          "ElasticsearchProvider.clearIndex",
          { indexName },
        ),
        "Index cleared successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ElasticsearchProvider.clearIndex",
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

      const response = await this.client?.search<T>({
        index: indexName,
        body,
      });

      if (!response) {
        throw new Error("Search request failed");
      }

      const results = (response.hits.hits || []).map((hit) => ({
        document: hit._source as T,
        score: hit._score ?? undefined,
        highlights: hit.highlight
          ? Object.entries(hit.highlight).reduce(
              (acc, [key, values]) => {
                acc[key] = values as string[];
                return acc;
              },
              {} as Record<string, string[]>,
            )
          : undefined,
      }));

      const total = response.hits.total
        ? typeof response.hits.total === "number"
          ? response.hits.total
          : response.hits.total.value
        : 0;

      const totalPages = Math.ceil(total / limit);

      // Extract facets
      const facets: Record<
        string,
        Array<{ value: string; count: number }>
      > = {};
      if (response.aggregations) {
        for (const [key, agg] of Object.entries(response.aggregations)) {
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
          "ElasticsearchProvider.search",
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
          "ElasticsearchProvider.updateIndexSettings",
          { indexName },
        ),
        "Index settings updated successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ElasticsearchProvider.updateIndexSettings",
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

      const indexMapping = mapping[indexName];
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
          "ElasticsearchProvider.getIndexSettings",
          error,
          { indexName },
        ),
        "Failed to get index settings",
      );
      throw error;
    }
  }

  private convertSettingsToElasticsearch(
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
