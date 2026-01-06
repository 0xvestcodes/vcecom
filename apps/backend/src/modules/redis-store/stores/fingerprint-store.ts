import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
} from "@nestjs/common";
import { carts, inArray } from "@vcecom/db";
import Redis from "ioredis";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../database/database.constants";
import type { Database } from "../../database/db";
import { KEY_PATTERNS } from "../constants/key-patterns";
import { RedisStoreService } from "../redis-store.service";

/**
 * Maximum number of active reservations allowed per device fingerprint
 * Prevents abuse by limiting how many carts a single device can have
 * Set to 0 or negative to disable the limit (unlimited reservations)
 * Can be overridden via MAX_RESERVATIONS_PER_FINGERPRINT environment variable
 */
const MAX_RESERVATIONS_PER_FINGERPRINT = process.env
  .MAX_RESERVATIONS_PER_FINGERPRINT
  ? parseInt(process.env.MAX_RESERVATIONS_PER_FINGERPRINT, 10)
  : 3;

@Injectable()
export class FingerprintStore implements OnModuleInit {
  private client!: Redis;

  constructor(
    private readonly redisStoreService: RedisStoreService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  async onModuleInit() {
    try {
      this.client = await this.redisStoreService.getClient();
      this.logger.info("FingerprintStore initialized successfully");
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "fingerprintStoreInit", error),
        "Redis client not available during FingerprintStore initialization",
      );
    }
  }

  /**
   * Get the number of active reservations for a given fingerprint
   * @param fingerprint - Device fingerprint hash
   * @returns Number of active reservations
   */
  async getActiveReservationCount(fingerprint: string): Promise<number> {
    const key = KEY_PATTERNS.FINGERPRINT_RESERVATIONS(fingerprint);
    try {
      const count = await this.client.scard(key);
      return count;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "getActiveReservationCount",
          error,
          { fingerprint },
        ),
        `Failed to get active reservation count for fingerprint ${fingerprint}`,
      );
      // Return 0 on error to allow operation (fail open)
      return 0;
    }
  }

  /**
   * Add a cart reservation to the fingerprint's active reservations set
   * @param fingerprint - Device fingerprint hash
   * @param cartId - Cart ID to track
   * @param ttlSeconds - TTL for the reservation entry (should match reservation TTL)
   */
  async addReservation(
    fingerprint: string,
    cartId: string,
    ttlSeconds: number = 900, // Default 15 minutes
  ): Promise<void> {
    const key = KEY_PATTERNS.FINGERPRINT_RESERVATIONS(fingerprint);
    try {
      // Add cartId to set
      await this.client.sadd(key, cartId);
      // Set TTL on the set (refreshes on each add)
      await this.client.expire(key, ttlSeconds);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "addReservation", error, {
          fingerprint,
          cartId,
        }),
        `Failed to add reservation for fingerprint ${fingerprint}, cart ${cartId}`,
      );
      // Don't throw - fingerprint tracking is non-critical
    }
  }

  /**
   * Remove a cart reservation from the fingerprint's active reservations set
   * @param fingerprint - Device fingerprint hash
   * @param cartId - Cart ID to remove
   */
  async removeReservation(fingerprint: string, cartId: string): Promise<void> {
    const key = KEY_PATTERNS.FINGERPRINT_RESERVATIONS(fingerprint);
    try {
      await this.client.srem(key, cartId);
      // If set is empty, delete it (cleanup)
      const count = await this.client.scard(key);
      if (count === 0) {
        await this.client.del(key);
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "removeReservation", error, {
          fingerprint,
          cartId,
        }),
        `Failed to remove reservation for fingerprint ${fingerprint}, cart ${cartId}`,
      );
      // Don't throw - fingerprint tracking is non-critical
    }
  }

  /**
   * Enforce maximum reservation limit per fingerprint
   * Automatically cleans up stale cart IDs that no longer exist in the database
   * Throws BadRequestException if limit exceeded after cleanup
   * @param fingerprint - Device fingerprint hash
   * @param limit - Maximum allowed reservations (default: 3)
   * @throws BadRequestException if limit exceeded
   */
  async enforceReservationLimit(
    fingerprint: string,
    limit: number = MAX_RESERVATIONS_PER_FINGERPRINT,
  ): Promise<void> {
    // If limit is 0 or negative, disable reservation limit (unlimited)
    if (limit <= 0) {
      this.logger.debug(
        createLogContext(this.contextService, "enforceReservationLimit", {
          fingerprint,
          limit,
          disabled: true,
        }),
        "Reservation limit disabled (unlimited reservations)",
      );
      return;
    }

    // Get all cart IDs tracked for this fingerprint
    const trackedCartIds = await this.getActiveCartIds(fingerprint);

    if (trackedCartIds.length === 0) {
      // No tracked carts, allow operation
      return;
    }

    // Clean up stale cart IDs that no longer exist in the database
    const validCartIds = await this.validateAndCleanupStaleCartIds(
      fingerprint,
      trackedCartIds,
    );

    // Check limit against valid carts only
    if (validCartIds.length >= limit) {
      this.logger.warn(
        createLogContext(this.contextService, "enforceReservationLimit", {
          fingerprint,
          currentCount: validCartIds.length,
          limit,
          validCartIds,
        }),
        `Reservation limit exceeded for fingerprint ${fingerprint}`,
      );
      throw new BadRequestException(
        `Maximum ${limit} active reservations allowed per device. Please complete or cancel existing reservations before adding more items.`,
      );
    }
  }

  /**
   * Validate cart IDs exist in database and remove stale ones from fingerprint set
   * @param fingerprint - Device fingerprint hash
   * @param cartIds - Array of cart IDs to validate
   * @returns Array of valid cart IDs that still exist
   */
  private async validateAndCleanupStaleCartIds(
    fingerprint: string,
    cartIds: string[],
  ): Promise<string[]> {
    if (cartIds.length === 0) {
      return [];
    }

    try {
      // Query database to find which carts actually exist
      const existingCarts = await this.db
        .select({ id: carts.id })
        .from(carts)
        .where(inArray(carts.id, cartIds));

      const existingCartIdSet = new Set(existingCarts.map((c) => c.id));

      // Find stale cart IDs (in Redis but not in database)
      const staleCartIds = cartIds.filter((id) => !existingCartIdSet.has(id));

      // Remove stale cart IDs from fingerprint set
      if (staleCartIds.length > 0) {
        const key = KEY_PATTERNS.FINGERPRINT_RESERVATIONS(fingerprint);
        await this.client.srem(key, ...staleCartIds);

        this.logger.info(
          createLogContext(
            this.contextService,
            "validateAndCleanupStaleCartIds",
            {
              fingerprint,
              staleCartIds,
              remainingValidCount: existingCarts.length,
            },
          ),
          `Cleaned up ${staleCartIds.length} stale cart IDs from fingerprint ${fingerprint}`,
        );
      }

      return Array.from(existingCartIdSet);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateAndCleanupStaleCartIds",
          error,
          { fingerprint, cartIdCount: cartIds.length },
        ),
        `Failed to validate cart IDs for fingerprint ${fingerprint}`,
      );
      // On error, return original cart IDs (fail open)
      return cartIds;
    }
  }

  /**
   * Get all active cart IDs for a fingerprint
   * @param fingerprint - Device fingerprint hash
   * @returns Array of cart IDs
   */
  async getActiveCartIds(fingerprint: string): Promise<string[]> {
    const key = KEY_PATTERNS.FINGERPRINT_RESERVATIONS(fingerprint);
    try {
      const cartIds = await this.client.smembers(key);
      return cartIds;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getActiveCartIds", error, {
          fingerprint,
        }),
        `Failed to get active cart IDs for fingerprint ${fingerprint}`,
      );
      return [];
    }
  }
}
