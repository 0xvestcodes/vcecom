import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { RedisStoreService } from "../../redis-store/redis-store.service";

export interface RelevanceConfig {
  fieldWeights: {
    title: number;
    description: number;
    sku: number;
    tags: number;
    collectionNames: number;
  };
  boostFactors: {
    popularity: number;
    recency: number;
    inventoryStatus: number;
  };
  synonyms: Record<string, string[]>;
  stopWords: string[];
  rankingRules: string[];
}

const DEFAULT_RELEVANCE_CONFIG: RelevanceConfig = {
  fieldWeights: {
    title: 2.0,
    description: 1.0,
    sku: 1.5,
    tags: 1.2,
    collectionNames: 1.0,
  },
  boostFactors: {
    popularity: 1.0,
    recency: 1.0,
    inventoryStatus: 1.1, // Boost in-stock items slightly
  },
  synonyms: {},
  stopWords: [
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
  ],
  rankingRules: [
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness",
  ],
};

@Injectable()
export class RelevanceConfigService {
  private readonly CONFIG_KEY = "search:relevance:config";

  constructor(
    private readonly redisStoreService: RedisStoreService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get current relevance configuration
   */
  async getConfig(): Promise<RelevanceConfig> {
    try {
      const client = await this.redisStoreService.getClient();
      const configJson = await client.get(this.CONFIG_KEY);

      if (!configJson) {
        // Return default config and save it
        await this.saveConfig(DEFAULT_RELEVANCE_CONFIG);
        return DEFAULT_RELEVANCE_CONFIG;
      }

      const config = JSON.parse(configJson) as RelevanceConfig;
      // Merge with defaults to ensure all fields are present
      return {
        ...DEFAULT_RELEVANCE_CONFIG,
        ...config,
        fieldWeights: {
          ...DEFAULT_RELEVANCE_CONFIG.fieldWeights,
          ...config.fieldWeights,
        },
        boostFactors: {
          ...DEFAULT_RELEVANCE_CONFIG.boostFactors,
          ...config.boostFactors,
        },
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "RelevanceConfigService.getConfig",
          error,
        ),
        "Failed to get relevance config, returning defaults",
      );
      return DEFAULT_RELEVANCE_CONFIG;
    }
  }

  /**
   * Update relevance configuration
   */
  async updateConfig(
    updates: Partial<RelevanceConfig>,
  ): Promise<RelevanceConfig> {
    try {
      const currentConfig = await this.getConfig();
      const updatedConfig: RelevanceConfig = {
        ...currentConfig,
        ...updates,
        fieldWeights: {
          ...currentConfig.fieldWeights,
          ...updates.fieldWeights,
        },
        boostFactors: {
          ...currentConfig.boostFactors,
          ...updates.boostFactors,
        },
        synonyms: {
          ...currentConfig.synonyms,
          ...updates.synonyms,
        },
        stopWords: updates.stopWords
          ? [...new Set(updates.stopWords)]
          : currentConfig.stopWords,
        rankingRules: updates.rankingRules
          ? updates.rankingRules
          : currentConfig.rankingRules,
      };

      await this.saveConfig(updatedConfig);

      this.logger.info(
        createLogContext(
          this.contextService,
          "RelevanceConfigService.updateConfig",
          {},
        ),
        "Relevance configuration updated",
      );

      return updatedConfig;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "RelevanceConfigService.updateConfig",
          error,
        ),
        "Failed to update relevance config",
      );
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(): Promise<RelevanceConfig> {
    return this.saveConfig(DEFAULT_RELEVANCE_CONFIG);
  }

  /**
   * Add a synonym mapping
   */
  async addSynonym(word: string, synonyms: string[]): Promise<void> {
    const config = await this.getConfig();
    config.synonyms[word.toLowerCase()] = synonyms.map((s) => s.toLowerCase());
    await this.saveConfig(config);
  }

  /**
   * Remove a synonym mapping
   */
  async removeSynonym(word: string): Promise<void> {
    const config = await this.getConfig();
    delete config.synonyms[word.toLowerCase()];
    await this.saveConfig(config);
  }

  /**
   * Add stop words
   */
  async addStopWords(words: string[]): Promise<void> {
    const config = await this.getConfig();
    const newStopWords = words.map((w) => w.toLowerCase());
    config.stopWords = [...new Set([...config.stopWords, ...newStopWords])];
    await this.saveConfig(config);
  }

  /**
   * Remove stop words
   */
  async removeStopWords(words: string[]): Promise<void> {
    const config = await this.getConfig();
    const wordsToRemove = new Set(words.map((w) => w.toLowerCase()));
    config.stopWords = config.stopWords.filter(
      (w) => !wordsToRemove.has(w.toLowerCase()),
    );
    await this.saveConfig(config);
  }

  /**
   * Save configuration to Redis
   */
  private async saveConfig(config: RelevanceConfig): Promise<RelevanceConfig> {
    try {
      const client = await this.redisStoreService.getClient();
      await client.set(this.CONFIG_KEY, JSON.stringify(config));

      this.logger.debug(
        createLogContext(
          this.contextService,
          "RelevanceConfigService.saveConfig",
          {},
        ),
        "Relevance configuration saved",
      );

      return config;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "RelevanceConfigService.saveConfig",
          error,
        ),
        "Failed to save relevance config",
      );
      throw error;
    }
  }
}
