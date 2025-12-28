import { Injectable, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { KEY_PATTERNS, TTL } from "../constants/key-patterns";
import { RedisStoreService } from "../redis-store.service";

@Injectable()
export class StaleMarkerStore implements OnModuleInit {
  private client!: Redis;

  constructor(
    private readonly redisStoreService: RedisStoreService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    try {
      this.client = await this.redisStoreService.getClient();
      this.logger.info(
        createLogContext(this.contextService, "onModuleInit", {}),
        "StaleMarkerStore initialized successfully",
      );
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "staleMarkerStoreInit", error),
        "Redis client not available for StaleMarkerStore during initialization",
      );
    }
  }

  /**
   * Mark cart item as stale
   * Sets a Redis key with TTL to indicate the item's reservation has expired
   */
  async markItemStale(cartId: string, variantId: string): Promise<void> {
    const key = KEY_PATTERNS.STALE_ITEM(cartId, variantId);
    try {
      await this.client.set(key, "1", "EX", TTL.STALE_ITEM);
      this.logger.debug(
        createLogContext(this.contextService, "markItemStale", {
          cartId,
          variantId,
        }),
        `Marked item as stale: cart ${cartId}, variant ${variantId}`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "markItemStale", error, {
          cartId,
          variantId,
        }),
        `Failed to mark item as stale: cart ${cartId}, variant ${variantId}`,
      );
      throw error;
    }
  }

  /**
   * Check if item is stale
   * Returns true if stale marker exists in Redis
   */
  async isItemStale(cartId: string, variantId: string): Promise<boolean> {
    const key = KEY_PATTERNS.STALE_ITEM(cartId, variantId);
    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "isItemStale", error, {
          cartId,
          variantId,
        }),
        `Failed to check if item is stale: cart ${cartId}, variant ${variantId}`,
      );
      return false; // Fail safe - assume not stale if check fails
    }
  }

  /**
   * Clear stale marker
   * Removes the stale marker when item is refreshed or reacquired
   */
  async clearStaleMarker(cartId: string, variantId: string): Promise<void> {
    const key = KEY_PATTERNS.STALE_ITEM(cartId, variantId);
    try {
      await this.client.del(key);
      this.logger.debug(
        createLogContext(this.contextService, "clearStaleMarker", {
          cartId,
          variantId,
        }),
        `Cleared stale marker: cart ${cartId}, variant ${variantId}`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "clearStaleMarker", error, {
          cartId,
          variantId,
        }),
        `Failed to clear stale marker: cart ${cartId}, variant ${variantId}`,
      );
      // Don't throw - clearing stale marker is best-effort
    }
  }

  /**
   * Get all stale items for a cart
   * Scans Redis for stale markers matching the cart ID pattern
   */
  async getStaleItems(cartId: string): Promise<string[]> {
    const pattern = KEY_PATTERNS.STALE_ITEM(cartId, "*");
    const staleVariantIds: string[] = [];

    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = nextCursor;

        // Extract variantId from key pattern: stale:item:{cartId}:{variantId}
        for (const key of keys) {
          const parts = key.split(":");
          if (parts.length === 4 && parts[0] === "stale" && parts[1] === "item") {
            const variantId = parts[3];
            if (variantId) {
              staleVariantIds.push(variantId);
            }
          }
        }
      } while (cursor !== "0");

      return staleVariantIds;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getStaleItems", error, {
          cartId,
        }),
        `Failed to get stale items for cart ${cartId}`,
      );
      return []; // Fail safe - return empty array if scan fails
    }
  }
}

