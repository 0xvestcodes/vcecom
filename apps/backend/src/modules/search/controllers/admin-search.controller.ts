import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AppConfigService } from "../../../common/config/app.config.service";
import { RateLimit } from "../../../common/decorators/rate-limit.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { SearchAvailableGuard } from "../../../common/guards/search-available.guard";
import { RATE_LIMIT_PRESETS } from "../../../common/rate-limiting/rate-limit.config";
import { ReindexRequestDto } from "../dto/reindex-request.dto";
import { RelevanceConfigDto } from "../dto/relevance-config.dto";
import { MeilisearchProvider } from "../providers/meilisearch.provider";
import {
  RelevanceConfig,
  RelevanceConfigService,
} from "../relevance/relevance-config.service";
import { RelevanceTunerService } from "../relevance/relevance-tuner.service";
import { SearchIndexerService } from "../search-indexer.service";
import { ReindexWorkerService } from "../workers/reindex-worker.service";

@ApiTags("admin")
@Controller("admin/search")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class AdminSearchController {
  constructor(
    private readonly reindexWorker: ReindexWorkerService,
    private readonly relevanceConfig: RelevanceConfigService,
    private readonly relevanceTuner: RelevanceTunerService,
    private readonly searchIndexer: SearchIndexerService,
    private readonly configService: AppConfigService,
    private readonly meilisearchProvider: MeilisearchProvider,
  ) {}

  @Post("reindex")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(SearchAvailableGuard)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Trigger search reindex",
    description:
      "Start a full or partial reindex of products and/or collections",
  })
  @ApiResponse({
    status: 202,
    description: "Reindex started successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Search is a paid feature and not available",
  })
  @ApiResponse({
    status: 409,
    description: "Reindex is already running",
  })
  async triggerReindex(@Body() request: ReindexRequestDto) {
    if (this.reindexWorker.isReindexRunning()) {
      return {
        message: "Reindex is already running",
        status: "running",
      };
    }

    // Start reindex in background (don't await)
    this.reindexWorker
      .startReindex({
        entityType: request.entityType,
        categoryId: request.categoryId,
        collectionId: request.collectionId,
        dateFrom: request.dateFrom ? new Date(request.dateFrom) : undefined,
        dateTo: request.dateTo ? new Date(request.dateTo) : undefined,
        batchSize: request.batchSize,
      })
      .catch((error) => {
        // Error handling is done in the worker
      });

    return {
      message: "Reindex started",
      status: "started",
    };
  }

  @Get("reindex/status")
  @UseGuards(SearchAvailableGuard)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get reindex status",
    description: "Get the current status and progress of a reindex operation",
  })
  @ApiResponse({
    status: 200,
    description: "Reindex status retrieved successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Search is a paid feature and not available",
  })
  async getReindexStatus() {
    const status = await this.reindexWorker.getStatus();
    return (
      status || {
        status: "idle",
        progress: {
          total: 0,
          processed: 0,
          failed: 0,
          percentage: 0,
        },
        startedAt: null,
        completedAt: null,
        error: null,
      }
    );
  }

  @Get("status")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get search provider status",
    description:
      "Get the current status and configuration of the search provider",
  })
  @ApiResponse({
    status: 200,
    description: "Search provider status",
  })
  async getStatus() {
    const searchConfig = this.configService.getSearchConfig();
    const meilisearchConfig = this.configService.getMeilisearchConfig();

    const isReady = this.meilisearchProvider.isReady();

    // If indexing is disabled, return early with appropriate message
    if (!searchConfig.indexingEnabled) {
      return {
        provider: searchConfig.provider,
        isReady: false,
        indexingEnabled: false,
        configuration: {
          meilisearch: {
            host: meilisearchConfig.host || "Not configured",
            hasApiKey: !!meilisearchConfig.apiKey,
          },
        },
        message:
          "Search indexing is disabled (SEARCH_INDEXING_ENABLED=false). Set SEARCH_INDEXING_ENABLED=true to enable search.",
        note: "Search queries will fallback to database search when indexing is disabled.",
      };
    }

    return {
      provider: searchConfig.provider,
      isReady,
      indexingEnabled: searchConfig.indexingEnabled,
      configuration: {
        meilisearch: {
          host: meilisearchConfig.host || "Not configured",
          hasApiKey: !!meilisearchConfig.apiKey,
        },
      },
      message: isReady
        ? "Search provider is ready"
        : !meilisearchConfig.host
          ? "MEILISEARCH_HOST environment variable is not set. Set it to http://localhost:7700 if running locally with Docker. Search queries will fallback to database search."
          : "Search provider is not ready. Check logs for initialization errors. Search queries will fallback to database search.",
      note: !isReady
        ? "Search queries will fallback to database search when the provider is not available."
        : undefined,
    };
  }

  @Get("stats")
  @UseGuards(SearchAvailableGuard)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get search statistics",
    description:
      "Get statistics about search indexes (document counts, sizes, etc.). Requires search to be configured.",
  })
  @ApiResponse({
    status: 200,
    description: "Search statistics retrieved successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Search is a paid feature and not available",
  })
  async getStats() {
    const searchConfig = this.configService.getSearchConfig();
    const meilisearchConfig = this.configService.getMeilisearchConfig();

    // If search indexing is disabled, return empty stats
    if (!searchConfig.indexingEnabled) {
      return {
        products: {
          documentCount: 0,
          size: 0,
          message:
            "Search indexing is disabled (SEARCH_INDEXING_ENABLED=false)",
        },
        collections: {
          documentCount: 0,
          size: 0,
          message:
            "Search indexing is disabled (SEARCH_INDEXING_ENABLED=false)",
        },
        message:
          "Search indexing is disabled. Set SEARCH_INDEXING_ENABLED=true to enable.",
      };
    }

    // If no search provider host is configured, return empty stats
    if (!meilisearchConfig.host) {
      return {
        products: {
          documentCount: 0,
          size: 0,
          message: "Search provider not configured",
        },
        collections: {
          documentCount: 0,
          size: 0,
          message: "Search provider not configured",
        },
        message:
          "MEILISEARCH_HOST environment variable is not set. Search is not configured.",
      };
    }

    // Try to get stats if provider is ready
    try {
      const stats = await this.searchIndexer.getIndexStats();
      return stats;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Search provider is not ready"
      ) {
        // Return empty stats with a message instead of throwing an error
        return {
          products: {
            documentCount: 0,
            size: 0,
            message: "Search provider is not ready",
          },
          collections: {
            documentCount: 0,
            size: 0,
            message: "Search provider is not ready",
          },
          message: `Search provider is not available. Current configuration: MEILISEARCH_HOST=${meilisearchConfig.host}. Please ensure Meilisearch is running and accessible at this address.`,
        };
      }
      throw error;
    }
  }

  @Get("relevance")
  @UseGuards(SearchAvailableGuard)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get relevance configuration",
    description: "Get the current relevance tuning configuration",
  })
  @ApiResponse({
    status: 200,
    description: "Relevance configuration retrieved successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Search is a paid feature and not available",
  })
  async getRelevanceConfig() {
    return this.relevanceConfig.getConfig();
  }

  @Put("relevance")
  @UseGuards(SearchAvailableGuard)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Update relevance configuration",
    description:
      "Update relevance tuning configuration (field weights, boost factors, synonyms, stop words). Requires search to be configured.",
  })
  @ApiResponse({
    status: 200,
    description: "Relevance configuration updated successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Search is a paid feature and not available",
  })
  async updateRelevanceConfig(@Body() config: RelevanceConfigDto) {
    // Map DTO to Partial<RelevanceConfig>, ensuring fieldWeights properties are numbers
    const configUpdate: Partial<RelevanceConfig> = {
      ...(config.fieldWeights && {
        fieldWeights: {
          title: config.fieldWeights.title ?? 2.0,
          description: config.fieldWeights.description ?? 1.0,
          sku: config.fieldWeights.sku ?? 1.5,
          tags: config.fieldWeights.tags ?? 1.2,
          collectionNames: config.fieldWeights.collectionNames ?? 1.0,
        },
      }),
      ...(config.boostFactors && {
        boostFactors: {
          popularity: config.boostFactors.popularity ?? 1.0,
          recency: config.boostFactors.recency ?? 1.0,
          inventoryStatus: config.boostFactors.inventoryStatus ?? 1.1,
        },
      }),
      ...(config.synonyms && { synonyms: config.synonyms }),
      ...(config.stopWords && { stopWords: config.stopWords }),
      ...(config.rankingRules && { rankingRules: config.rankingRules }),
    };
    const updatedConfig = await this.relevanceConfig.updateConfig(configUpdate);

    // Apply settings to indexes (if search is available)
    const searchConfig = this.configService.getSearchConfig();
    if (searchConfig.indexingEnabled) {
      try {
        await this.relevanceTuner.applyRelevanceSettings();
      } catch (_error) {
        // Log error but don't fail the request - config is saved
        // The error will be logged by the relevance tuner service
        return {
          ...updatedConfig,
          warning:
            "Configuration saved but could not be applied to search indexes. Search provider may not be available.",
        };
      }
    }

    return updatedConfig;
  }

  @Post("relevance/reset")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SearchAvailableGuard)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Reset relevance configuration",
    description:
      "Reset relevance configuration to default values. Requires search to be configured.",
  })
  @ApiResponse({
    status: 200,
    description: "Relevance configuration reset successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Search is a paid feature and not available",
  })
  async resetRelevanceConfig() {
    const config = await this.relevanceConfig.resetConfig();

    // Apply settings to indexes (if search is available)
    const searchConfig = this.configService.getSearchConfig();
    if (searchConfig.indexingEnabled) {
      try {
        await this.relevanceTuner.applyRelevanceSettings();
      } catch (_error) {
        // Log error but don't fail the request - config is reset
        // The error will be logged by the relevance tuner service
        return {
          ...config,
          warning:
            "Configuration reset but could not be applied to search indexes. Search provider may not be available.",
        };
      }
    }

    return config;
  }

  @Post("sync")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SearchAvailableGuard)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Manual sync operation",
    description:
      "Trigger a manual sync of search indexes (reinitialize indexes). Requires search to be configured.",
  })
  @ApiResponse({
    status: 200,
    description: "Sync operation completed",
  })
  @ApiResponse({
    status: 403,
    description: "Search is a paid feature and not available",
  })
  async sync() {
    const searchConfig = this.configService.getSearchConfig();
    const meilisearchConfig = this.configService.getMeilisearchConfig();

    // If search indexing is disabled, return early
    if (!searchConfig.indexingEnabled) {
      return {
        message:
          "Search indexing is disabled (SEARCH_INDEXING_ENABLED=false). No sync performed.",
        indexingEnabled: false,
      };
    }

    // If no search provider host is configured, return early
    if (!meilisearchConfig.host) {
      return {
        message:
          "Search provider not configured (MEILISEARCH_HOST not set). No sync performed.",
        configured: false,
      };
    }

    try {
      await this.searchIndexer.initializeIndexes();
      await this.relevanceTuner.applyRelevanceSettings();

      return {
        message: "Search indexes synchronized successfully",
      };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "Search provider is not ready" ||
          error.message === "Search provider is not initialized")
      ) {
        return {
          message: `Search provider is not available. Current configuration: MEILISEARCH_HOST=${meilisearchConfig.host}. Please ensure Meilisearch is running and accessible at this address.`,
          error: "Search provider not ready",
        };
      }
      throw error;
    }
  }
}
