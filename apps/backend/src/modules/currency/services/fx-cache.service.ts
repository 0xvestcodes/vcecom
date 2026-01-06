import { Injectable, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { KEY_PATTERNS, TTL } from "../../redis-store/constants/key-patterns";
import { RedisStoreService } from "../../redis-store/redis-store.service";

/**
 * FX Cache Service
 * Handles caching of exchange rates in Redis
 */
@Injectable()
export class FxCacheService implements OnModuleInit {
  private client!: Redis;

  constructor(
    private readonly redisStoreService: RedisStoreService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    try {
      this.client = await this.redisStoreService.getClient();
    } catch (error) {
      this.logger.warn(
        `Redis client not available during initialization - will retry when Redis is available: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      // Don't throw - allow app to start without Redis
    }
  }

  /**
   * Get exchange rate from cache
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @returns Cached exchange rate or null if not found
   */
  async getRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number | null> {
    if (!this.client) {
      return null;
    }

    if (fromCurrency === toCurrency) {
      return 1;
    }

    try {
      const key = KEY_PATTERNS.FX_RATE(fromCurrency, toCurrency);
      const cached = await this.client.get(key);

      if (cached) {
        const rate = parseFloat(cached);
        if (!Number.isNaN(rate) && rate > 0) {
          this.logger.debug(
            createLogContext(this.contextService, "getRate", {
              fromCurrency,
              toCurrency,
              rate,
            }),
            "FX rate cache hit",
          );
          return rate;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getRate", error, {
          fromCurrency,
          toCurrency,
        }),
        "Failed to get FX rate from cache",
      );
      return null;
    }
  }

  /**
   * Set exchange rate in cache
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param rate - Exchange rate to cache
   */
  async setRate(
    fromCurrency: string,
    toCurrency: string,
    rate: number,
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    if (fromCurrency === toCurrency) {
      return;
    }

    try {
      const key = KEY_PATTERNS.FX_RATE(fromCurrency, toCurrency);
      const ttl = TTL.FX_RATE;

      await this.client.setex(key, ttl, rate.toString());

      this.logger.debug(
        createLogContext(this.contextService, "setRate", {
          fromCurrency,
          toCurrency,
          rate,
          ttl,
        }),
        "FX rate cached",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "setRate", error, {
          fromCurrency,
          toCurrency,
          rate,
        }),
        "Failed to cache FX rate",
      );
    }
  }

  /**
   * Get multiple exchange rates from cache
   * @param baseCurrency - Base currency code
   * @param targetCurrencies - Array of target currency codes
   * @returns Object mapping target currencies to cached rates (only includes found rates)
   */
  async getRates(
    baseCurrency: string,
    targetCurrencies: string[],
  ): Promise<Record<string, number>> {
    if (!this.client || targetCurrencies.length === 0) {
      return {};
    }

    const rates: Record<string, number> = {};
    rates[baseCurrency] = 1; // Base currency rate is always 1

    try {
      const keys = targetCurrencies
        .filter((target) => target !== baseCurrency)
        .map((target) => KEY_PATTERNS.FX_RATE(baseCurrency, target));

      if (keys.length === 0) {
        return rates;
      }

      const values = await this.client.mget(...keys);

      for (let i = 0; i < keys.length; i++) {
        const target = targetCurrencies.find(
          (t) => t !== baseCurrency && keys[i].includes(t),
        );
        if (!target) continue;

        const cached = values[i];
        if (cached) {
          const rate = parseFloat(cached);
          if (!Number.isNaN(rate) && rate > 0) {
            rates[target] = rate;
          }
        }
      }

      this.logger.debug(
        createLogContext(this.contextService, "getRates", {
          baseCurrency,
          targetCurrencies,
          found: Object.keys(rates).length - 1, // Exclude base currency
        }),
        "FX rates fetched from cache",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getRates", error, {
          baseCurrency,
          targetCurrencies,
        }),
        "Failed to get FX rates from cache",
      );
    }

    return rates;
  }

  /**
   * Set multiple exchange rates in cache
   * @param baseCurrency - Base currency code
   * @param rates - Object mapping target currencies to rates
   */
  async setRates(
    baseCurrency: string,
    rates: Record<string, number>,
  ): Promise<void> {
    if (!this.client || Object.keys(rates).length === 0) {
      return;
    }

    try {
      const ttl = TTL.FX_RATE;
      const pipeline = this.client.pipeline();

      for (const [targetCurrency, rate] of Object.entries(rates)) {
        if (targetCurrency === baseCurrency) {
          continue;
        }

        const key = KEY_PATTERNS.FX_RATE(baseCurrency, targetCurrency);
        pipeline.setex(key, ttl, rate.toString());
      }

      await pipeline.exec();

      this.logger.debug(
        createLogContext(this.contextService, "setRates", {
          baseCurrency,
          count: Object.keys(rates).length - 1, // Exclude base currency
          ttl,
        }),
        "FX rates cached",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "setRates", error, {
          baseCurrency,
          rates,
        }),
        "Failed to cache FX rates",
      );
    }
  }

  /**
   * Invalidate exchange rate cache for a currency pair
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   */
  async invalidateRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const key = KEY_PATTERNS.FX_RATE(fromCurrency, toCurrency);
      await this.client.del(key);

      this.logger.debug(
        createLogContext(this.contextService, "invalidateRate", {
          fromCurrency,
          toCurrency,
        }),
        "FX rate cache invalidated",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "invalidateRate", error, {
          fromCurrency,
          toCurrency,
        }),
        "Failed to invalidate FX rate cache",
      );
    }
  }
}
