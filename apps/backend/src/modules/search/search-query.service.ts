import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "../../common/config/app.config.service";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { ElasticsearchProvider } from "./providers/elasticsearch.provider";
import { MeilisearchProvider } from "./providers/meilisearch.provider";
import { OpenSearchProvider } from "./providers/opensearch.provider";
import type { ISearchProvider } from "./providers/search-provider.interface";
import { SearchIndexerService } from "./search-indexer.service";
import type { ProductSearchDocument } from "./types/search-document.types";
import type {
  SearchQuery,
  SearchResponse,
} from "./types/search-provider.types";

/**
 * Search query service
 * Handles search queries using indexed search with fallback to database search
 */
@Injectable()
export class SearchQueryService {
  private provider: ISearchProvider | null = null;
  private readonly PRODUCTS_INDEX = "products";

  constructor(
    private readonly configService: AppConfigService,
    private readonly meilisearchProvider: MeilisearchProvider,
    private readonly elasticsearchProvider: ElasticsearchProvider,
    private readonly opensearchProvider: OpenSearchProvider,
    readonly _searchIndexer: SearchIndexerService,
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
            "SearchQueryService.initializeProvider",
            { provider: searchConfig.provider },
          ),
          "Unknown search provider, will use database fallback",
        );
    }
  }

  /**
   * Check if indexed search is available
   */
  private isIndexedSearchAvailable(): boolean {
    return (
      (this.provider?.isReady() ?? false) &&
      this.configService.getSearchConfig().indexingEnabled
    );
  }

  /**
   * Search products using indexed search
   */
  async searchProducts(
    query: string,
    options: {
      page?: number;
      limit?: number;
      categoryId?: string;
      collectionId?: string;
      minPrice?: number;
      maxPrice?: number;
      inStock?: boolean;
      status?: string;
      tags?: string[];
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {},
  ): Promise<SearchResponse<ProductSearchDocument>> {
    // Try indexed search first
    if (this.isIndexedSearchAvailable()) {
      try {
        const searchQuery: SearchQuery = {
          query: query || "",
          filters: {
            categoryId: options.categoryId,
            collectionId: options.collectionId,
            minPrice: options.minPrice,
            maxPrice: options.maxPrice,
            inStock: options.inStock,
            status: options.status || "active", // Default to active products
            tags: options.tags,
          },
          page: options.page || 1,
          limit: options.limit || 20,
        };

        // Build sort
        if (options.sortBy) {
          searchQuery.sort = [
            {
              field: options.sortBy,
              direction: options.sortOrder || "desc",
            },
          ];
        } else {
          // Default sort by relevance (score)
          searchQuery.sort = [{ field: "_score", direction: "desc" }];
        }

        const result = await this.provider?.search<ProductSearchDocument>(
          this.PRODUCTS_INDEX,
          searchQuery,
        );

        if (!result) {
          throw new Error("Search request failed");
        }

        this.logger.debug(
          createLogContext(
            this.contextService,
            "SearchQueryService.searchProducts",
            { query, resultCount: result.total },
          ),
          "Search completed using indexed search",
        );

        return result;
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "SearchQueryService.searchProducts",
            error,
            { query },
          ),
          "Indexed search failed, falling back to database search",
        );
        // Fall through to database search
      }
    }

    // Fallback to database search (will be implemented by ProductsService)
    throw new Error(
      "Indexed search not available, use ProductsService.search() for database fallback",
    );
  }

  /**
   * Search collections using indexed search
   */
  async searchCollections(
    query: string,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {},
  ): Promise<SearchResponse> {
    if (!this.isIndexedSearchAvailable()) {
      throw new Error("Indexed search not available");
    }

    try {
      const searchQuery: SearchQuery = {
        query: query || "",
        filters: {
          type: options.type,
        },
        page: options.page || 1,
        limit: options.limit || 20,
      };

      if (options.sortBy) {
        searchQuery.sort = [
          {
            field: options.sortBy,
            direction: options.sortOrder || "desc",
          },
        ];
      }

      const result = await this.provider?.search("collections", searchQuery);

      if (!result) {
        throw new Error("Search request failed");
      }

      this.logger.debug(
        createLogContext(
          this.contextService,
          "SearchQueryService.searchCollections",
          { query, resultCount: result.total },
        ),
        "Collection search completed",
      );

      return result;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "SearchQueryService.searchCollections",
          error,
          { query },
        ),
        "Failed to search collections",
      );
      throw error;
    }
  }
}
