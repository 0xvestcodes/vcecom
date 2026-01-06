import { createHash } from "node:crypto";
import { Injectable, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { RedisStoreService } from "../../redis-store/redis-store.service";
import { DateRange } from "../dto/common.dto";

/**
 * Redis key patterns for analytics metrics
 */
const KEY_PATTERNS = {
  ORDER_METRICS: (periodHash: string) =>
    `analytics:orders:metrics:${periodHash}`,
  ORDER_STATUS_BREAKDOWN: (periodHash: string) =>
    `analytics:orders:status:${periodHash}`,
  ORDER_TRENDS: (periodHash: string, granularity: string) =>
    `analytics:orders:trends:${granularity}:${periodHash}`,
  SALES_REVENUE: (periodHash: string) =>
    `analytics:sales:revenue:${periodHash}`,
  SALES_CATEGORY: (periodHash: string) =>
    `analytics:sales:category:${periodHash}`,
  SALES_PAYMENT_METHOD: (periodHash: string) =>
    `analytics:sales:payment:${periodHash}`,
  CUSTOMER_SEGMENTATION: (date: string) =>
    `analytics:customers:segmentation:${date}`,
  CUSTOMER_RFM: (date: string) => `analytics:customers:rfm:${date}`,
  CUSTOMER_TOP: (limit: number, periodHash: string) =>
    `analytics:customers:top:${limit}:${periodHash}`,
  PRODUCT_TOP: (limit: number, periodHash: string) =>
    `analytics:products:top:${limit}:${periodHash}`,
  PRODUCT_CATEGORY: (periodHash: string) =>
    `analytics:products:category:${periodHash}`,
  PRODUCT_VARIANTS: (periodHash: string) =>
    `analytics:products:variants:${periodHash}`,
  PRODUCT_INVENTORY_TURNOVER: (periodHash: string) =>
    `analytics:products:turnover:${periodHash}`,
} as const;

/**
 * Cache TTL in seconds
 */
const CACHE_TTL = {
  REALTIME: 5 * 60, // 5 minutes for today's metrics
  RECENT: 15 * 60, // 15 minutes for this week's metrics
  HISTORICAL: 60 * 60, // 1 hour for this month+ metrics
  PRECOMPUTED: 24 * 60 * 60, // 24 hours for pre-computed metrics
} as const;

@Injectable()
export class CachedMetricsService implements OnModuleInit {
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
        createLogContext(
          this.contextService,
          "CachedMetricsService.onModuleInit",
          {
            error: error instanceof Error ? error.message : String(error),
          },
        ),
        "Redis client not available during initialization - will retry when Redis is available",
      );
    }
  }

  /**
   * Generate hash for date range (for cache key)
   */
  private hashDateRange(period: DateRange): string {
    const hash = createHash("sha256");
    hash.update(period.startDate.toISOString());
    hash.update(period.endDate.toISOString());
    return hash.digest("hex").substring(0, 16);
  }

  /**
   * Determine TTL based on period
   */
  private getTTL(period: DateRange): number {
    const now = new Date();
    const daysDiff = Math.floor(
      (now.getTime() - period.endDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDiff === 0) {
      return CACHE_TTL.REALTIME;
    } else if (daysDiff < 7) {
      return CACHE_TTL.RECENT;
    } else {
      return CACHE_TTL.HISTORICAL;
    }
  }

  /**
   * Get cached metric or compute and cache
   */
  async getCachedMetric<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    try {
      if (!this.client) {
        this.client = await this.redisStoreService.getClient();
      }

      // Try to get from cache
      const cached = await this.client.get(key);
      if (cached) {
        this.logger.debug(
          createLogContext(this.contextService, "getCachedMetric", { key }),
          "Cache hit",
        );
        return JSON.parse(cached) as T;
      }

      // Cache miss - compute value
      this.logger.debug(
        createLogContext(this.contextService, "getCachedMetric", { key }),
        "Cache miss - computing value",
      );
      const value = await computeFn();

      // Store in cache
      const cacheTTL = ttl ?? CACHE_TTL.HISTORICAL;
      await this.client.setex(key, cacheTTL, JSON.stringify(value));

      return value;
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "getCachedMetric", error, {
          key,
        }),
        "Failed to get cached metric - computing directly",
      );
      // Fallback to direct computation if cache fails
      return computeFn();
    }
  }

  /**
   * Get cached order metrics
   */
  async getCachedOrderMetrics<T>(
    period: DateRange,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const periodHash = this.hashDateRange(period);
    const key = KEY_PATTERNS.ORDER_METRICS(periodHash);
    const ttl = this.getTTL(period);
    return this.getCachedMetric(key, computeFn, ttl);
  }

  /**
   * Get cached order status breakdown
   */
  async getCachedOrderStatusBreakdown<T>(
    period: DateRange,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const periodHash = this.hashDateRange(period);
    const key = KEY_PATTERNS.ORDER_STATUS_BREAKDOWN(periodHash);
    const ttl = this.getTTL(period);
    return this.getCachedMetric(key, computeFn, ttl);
  }

  /**
   * Get cached order trends
   */
  async getCachedOrderTrends<T>(
    period: DateRange,
    granularity: string,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const periodHash = this.hashDateRange(period);
    const key = KEY_PATTERNS.ORDER_TRENDS(periodHash, granularity);
    const ttl = this.getTTL(period);
    return this.getCachedMetric(key, computeFn, ttl);
  }

  /**
   * Get cached sales revenue metrics
   */
  async getCachedSalesRevenue<T>(
    period: DateRange,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const periodHash = this.hashDateRange(period);
    const key = KEY_PATTERNS.SALES_REVENUE(periodHash);
    const ttl = this.getTTL(period);
    return this.getCachedMetric(key, computeFn, ttl);
  }

  /**
   * Get cached sales by category
   */
  async getCachedSalesByCategory<T>(
    period: DateRange,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const periodHash = this.hashDateRange(period);
    const key = KEY_PATTERNS.SALES_CATEGORY(periodHash);
    const ttl = this.getTTL(period);
    return this.getCachedMetric(key, computeFn, ttl);
  }

  /**
   * Get cached sales by payment method
   */
  async getCachedSalesByPaymentMethod<T>(
    period: DateRange,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const periodHash = this.hashDateRange(period);
    const key = KEY_PATTERNS.SALES_PAYMENT_METHOD(periodHash);
    const ttl = this.getTTL(period);
    return this.getCachedMetric(key, computeFn, ttl);
  }

  /**
   * Get cached customer segmentation
   */
  async getCachedCustomerSegmentation<T>(
    date: Date,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const dateStr = date.toISOString().split("T")[0];
    const key = KEY_PATTERNS.CUSTOMER_SEGMENTATION(dateStr);
    return this.getCachedMetric(key, computeFn, CACHE_TTL.PRECOMPUTED);
  }

  /**
   * Get cached RFM analysis
   */
  async getCachedRFMAnalysis<T>(
    date: Date,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const dateStr = date.toISOString().split("T")[0];
    const key = KEY_PATTERNS.CUSTOMER_RFM(dateStr);
    return this.getCachedMetric(key, computeFn, CACHE_TTL.PRECOMPUTED);
  }

  /**
   * Get cached top customers
   */
  async getCachedTopCustomers<T>(
    limit: number,
    period: DateRange,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const periodHash = this.hashDateRange(period);
    const key = KEY_PATTERNS.CUSTOMER_TOP(limit, periodHash);
    const ttl = this.getTTL(period);
    return this.getCachedMetric(key, computeFn, ttl);
  }

  /**
   * Get cached top products
   */
  async getCachedTopProducts<T>(
    limit: number,
    period: DateRange,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const periodHash = this.hashDateRange(period);
    const key = KEY_PATTERNS.PRODUCT_TOP(limit, periodHash);
    const ttl = this.getTTL(period);
    return this.getCachedMetric(key, computeFn, ttl);
  }

  /**
   * Get cached category performance
   */
  async getCachedCategoryPerformance<T>(
    period: DateRange,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const periodHash = this.hashDateRange(period);
    const key = KEY_PATTERNS.PRODUCT_CATEGORY(periodHash);
    const ttl = this.getTTL(period);
    return this.getCachedMetric(key, computeFn, ttl);
  }

  /**
   * Get cached variant performance
   */
  async getCachedVariantPerformance<T>(
    period: DateRange,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const periodHash = this.hashDateRange(period);
    const key = KEY_PATTERNS.PRODUCT_VARIANTS(periodHash);
    const ttl = this.getTTL(period);
    return this.getCachedMetric(key, computeFn, ttl);
  }

  /**
   * Get cached inventory turnover
   */
  async getCachedInventoryTurnover<T>(
    period: DateRange,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const periodHash = this.hashDateRange(period);
    const key = KEY_PATTERNS.PRODUCT_INVENTORY_TURNOVER(periodHash);
    const ttl = this.getTTL(period);
    return this.getCachedMetric(key, computeFn, ttl);
  }

  /**
   * Invalidate metrics matching pattern
   */
  async invalidateMetric(pattern: string): Promise<void> {
    try {
      if (!this.client) {
        this.client = await this.redisStoreService.getClient();
      }

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.debug(
          createLogContext(this.contextService, "invalidateMetric", {
            pattern,
            keysDeleted: keys.length,
          }),
          "Invalidated metrics",
        );
      }
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "invalidateMetric", error, {
          pattern,
        }),
        "Failed to invalidate metrics",
      );
    }
  }

  /**
   * Warm cache with specified metrics
   */
  async warmCache(
    metrics: Array<{
      key: string;
      computeFn: () => Promise<unknown>;
      ttl?: number;
    }>,
  ): Promise<void> {
    try {
      if (!this.client) {
        this.client = await this.redisStoreService.getClient();
      }

      const promises = metrics.map(async ({ key, computeFn, ttl }) => {
        try {
          const value = await computeFn();
          const cacheTTL = ttl ?? CACHE_TTL.HISTORICAL;
          await this.client.setex(key, cacheTTL, JSON.stringify(value));
        } catch (error) {
          this.logger.warn(
            createErrorContext(this.contextService, "warmCache", error, {
              key,
            }),
            "Failed to warm cache for metric",
          );
        }
      });

      await Promise.all(promises);
      this.logger.debug(
        createLogContext(this.contextService, "warmCache", {
          metricsCount: metrics.length,
        }),
        "Cache warmed",
      );
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "warmCache", error, {}),
        "Failed to warm cache",
      );
    }
  }
}
