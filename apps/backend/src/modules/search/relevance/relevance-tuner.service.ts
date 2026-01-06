import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { SearchIndexerService } from "../search-indexer.service";
import type { IndexSettings } from "../types/search-provider.types";
import { RelevanceConfigService } from "./relevance-config.service";

/**
 * Relevance tuner service
 * Applies relevance configuration to search queries and index settings
 */
@Injectable()
export class RelevanceTunerService {
  constructor(
    private readonly relevanceConfig: RelevanceConfigService,
    private readonly searchIndexer: SearchIndexerService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get index settings based on relevance configuration
   */
  async getIndexSettings(): Promise<IndexSettings> {
    const config = await this.relevanceConfig.getConfig();

    // Convert relevance config to index settings
    const searchableAttributes: string[] = [];
    const rankingRules: string[] = config.rankingRules || [];

    // Build searchable attributes with weights
    if (config.fieldWeights.title > 0) {
      searchableAttributes.push(`title^${config.fieldWeights.title}`);
    }
    if (config.fieldWeights.description > 0) {
      searchableAttributes.push(
        `description^${config.fieldWeights.description}`,
      );
    }
    if (config.fieldWeights.sku > 0) {
      searchableAttributes.push(`variants.sku^${config.fieldWeights.sku}`);
    }
    if (config.fieldWeights.tags > 0) {
      searchableAttributes.push(`tags^${config.fieldWeights.tags}`);
    }
    if (config.fieldWeights.collectionNames > 0) {
      searchableAttributes.push(
        `collectionNames^${config.fieldWeights.collectionNames}`,
      );
    }

    return {
      searchableAttributes,
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
      rankingRules,
      synonyms: config.synonyms,
      stopWords: config.stopWords,
    };
  }

  /**
   * Apply relevance configuration to search indexes
   */
  async applyRelevanceSettings(): Promise<void> {
    try {
      const settings = await this.getIndexSettings();

      // Update products index settings
      const provider = (
        this.searchIndexer as unknown as {
          provider: {
            updateIndexSettings: (
              index: string,
              settings: IndexSettings,
            ) => Promise<void>;
          };
        }
      ).provider;

      if (provider && typeof provider.updateIndexSettings === "function") {
        await provider.updateIndexSettings("products", settings);
        await provider.updateIndexSettings("collections", {
          searchableAttributes: ["name", "description"],
          filterableAttributes: ["type"],
          sortableAttributes: ["name", "createdAt", "updatedAt"],
          rankingRules: settings.rankingRules,
          synonyms: settings.synonyms,
          stopWords: settings.stopWords,
        });

        this.logger.info(
          createLogContext(
            this.contextService,
            "RelevanceTunerService.applyRelevanceSettings",
            {},
          ),
          "Relevance settings applied to search indexes",
        );
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "RelevanceTunerService.applyRelevanceSettings",
          error,
        ),
        "Failed to apply relevance settings",
      );
      throw error;
    }
  }
}
