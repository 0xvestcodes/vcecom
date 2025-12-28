import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
} from "@nestjs/common";
import Redis from "ioredis";
import { PinoLogger } from "nestjs-pino";
import {
  CHECKOUT_LOCK_TTL,
  INVENTORY_THRESHOLDS,
  RESERVATION_MODES,
  RESERVATION_TTL_TIERS,
  type ReservationMode,
} from "../../../common/constants/inventory.constants";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.constants";
import type { Database } from "../../../modules/database/db";
import { KEY_PATTERNS, TTL } from "../constants/key-patterns";
import { IInventoryStore } from "../interfaces/redis-store.interface";
import { RedisStoreService } from "../redis-store.service";
import {
  calculateTotalReservedFromReservations,
  fixImpossibleReservedState,
  fixNegativeReservedCount,
  fixReservationInconsistency,
  groupReservationsByVariant,
  parseReservedKey,
  processOrphanedReservations,
  releaseOrphanedReservations,
  scanKeys,
} from "./inventory-reconciliation.helper";

/**
 * Helper function to load Lua script with multiple path fallbacks
 * Exported for use by other stores that need to load Lua scripts
 */
export function loadLuaScript(scriptName: string, currentDir: string): string {
  const scriptPaths = [
    // Compiled path (dist)
    join(currentDir, "../scripts", scriptName),
    // Source path from dist
    join(currentDir, "../../../src/modules/redis-store/scripts", scriptName),
    // Source path from process.cwd() (repo root)
    join(
      process.cwd(),
      "apps/backend/src/modules/redis-store/scripts",
      scriptName,
    ),
    // Absolute path fallback
    join(process.cwd(), "src/modules/redis-store/scripts", scriptName),
  ];

  for (const scriptPath of scriptPaths) {
    try {
      return readFileSync(scriptPath, "utf-8");
    } catch {}
  }

  throw new Error(
    `Failed to load Lua script '${scriptName}' from any of the following paths: ${scriptPaths.join(", ")}`,
  );
}

@Injectable()
export class InventoryStore implements IInventoryStore, OnModuleInit {
  private client!: Redis;
  private readonly redisStoreService: RedisStoreService;
  private reserveInventoryScriptSha: string | null = null;
  private releaseInventoryScriptSha: string | null = null;
  private commitReservationScriptSha: string | null = null;
  private validateInventoryScriptSha: string | null = null;
  private reacquireInventoryScriptSha: string | null = null;

  constructor(
    redisStoreService: RedisStoreService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {
    this.redisStoreService = redisStoreService;
  }

  async onModuleInit() {
    // Initialize Redis client - don't block if Redis is unavailable
    // Wrap entire initialization in timeout to prevent blocking
    try {
      const initPromise = (async () => {
        this.client = await this.redisStoreService.getClient();

        // Load all Lua scripts with timeout to avoid blocking startup
        const scripts = [
          { name: "reserve-inventory.lua", sha: "reserveInventoryScriptSha" },
          { name: "release-inventory.lua", sha: "releaseInventoryScriptSha" },
          { name: "commit-reservation.lua", sha: "commitReservationScriptSha" },
          { name: "validate-inventory.lua", sha: "validateInventoryScriptSha" },
          { name: "set-checkout-lock.lua", sha: "setCheckoutLockScriptSha" },
          { name: "update-heartbeat.lua", sha: "updateHeartbeatScriptSha" },
          {
            name: "reacquire-inventory.lua",
            sha: "reacquireInventoryScriptSha",
          },
        ];

        for (const scriptInfo of scripts) {
          const script = loadLuaScript(scriptInfo.name, __dirname);
          const sha = (await Promise.race([
            this.client.script("LOAD", script),
            new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error("Script load timeout")), 2000),
            ),
          ])) as string;

          (this as unknown as Record<string, string | null>)[scriptInfo.sha] =
            sha;
          this.logger.info(
            createLogContext(this.contextService, "onModuleInit", {
              scriptName: scriptInfo.name,
            }),
            `Lua script ${scriptInfo.name} loaded successfully`,
          );
        }
      })();

      // Add overall timeout for entire initialization (3 seconds total)
      await Promise.race([
        initPromise,
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error("InventoryStore init timeout")),
            3000,
          ),
        ),
      ]);
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "redisInit", error),
        "Redis client not available during initialization - will retry when Redis is available",
      );
      // Don't throw - allow app to start without Redis
    }
  }

  /**
   * Get a value from Redis
   */
  async get<T = string>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      this.logger.error(
        `Failed to get key ${key}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Set a value in Redis
   */
  async set(
    key: string,
    value: string | number | object,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const serialized =
        typeof value === "string" ? value : JSON.stringify(value);
      if (ttlSeconds !== undefined) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(
        `Failed to set key ${key}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Delete a key from Redis
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(
        `Failed to delete key ${key}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to check existence of key ${key}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Reserve inventory for a variant (atomic operation using Lua script)
   */
  async reserveInventory(
    cartId: string,
    variantId: string,
    quantity: number,
    ttlSeconds: number = TTL.INVENTORY_RESERVATION,
  ): Promise<void> {
    if (!this.reserveInventoryScriptSha) {
      throw new Error("Reservation Lua script not loaded");
    }

    const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variantId);
    const reservedKey = KEY_PATTERNS.INVENTORY_RESERVED(variantId);
    const reservationKey = KEY_PATTERNS.INVENTORY_RESERVATION(
      cartId,
      variantId,
    );
    // Use dummy key for KEYS[4] since script expects 4 keys but we're using hard mode
    const softReservedKey = KEY_PATTERNS.INVENTORY_SOFT_RESERVED(variantId);

    try {
      const result = await this.client.evalsha(
        this.reserveInventoryScriptSha,
        4,
        inventoryKey,
        reservedKey,
        reservationKey,
        softReservedKey,
        quantity.toString(),
        ttlSeconds.toString(),
        "hard", // mode
        "0", // softLimit (not used in hard mode)
      );

      // Handle Lua script result
      if (Array.isArray(result) && result[0] === "err") {
        if (result[1] === "INSUFFICIENT_INVENTORY") {
          const available = result[2] as number;
          throw new BadRequestException(
            `Insufficient inventory. Available: ${available}`,
          );
        }
        throw new Error(`Reservation failed: ${result[1]}`);
      }

      this.logger.debug(
        `Reserved ${quantity} units of inventory for cart ${cartId}, variant ${variantId}`,
      );
    } catch (error) {
      // Increment failed reservations counter
      try {
        await this.client.incr("inventory:failed_reservations");
      } catch {
        // Ignore counter increment errors
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to reserve inventory for cart ${cartId}, variant ${variantId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Determine reservation mode based on available inventory
   */
  async determineReservationMode(variantId: string): Promise<{
    mode: ReservationMode;
    softLimit?: number;
    totalAvailable: number;
    totalReserved: number;
  }> {
    const available = (await this.getAvailableInventory(variantId)) || 0;
    const reserved = await this.getReservedInventory(variantId);

    // No inventory - waitlist mode
    if (available === 0) {
      return {
        mode: RESERVATION_MODES.WAITLIST,
        totalAvailable: available,
        totalReserved: reserved,
      };
    }

    // Low stock - soft reservation mode
    if (
      available <= INVENTORY_THRESHOLDS.LOW_STOCK_THRESHOLD &&
      available >= INVENTORY_THRESHOLDS.MIN_UNITS_FOR_SOFT_RESERVATION
    ) {
      const softLimit = Math.floor(
        available * INVENTORY_THRESHOLDS.SOFT_RESERVATION_MULTIPLIER,
      );
      return {
        mode: RESERVATION_MODES.SOFT,
        softLimit,
        totalAvailable: available,
        totalReserved: reserved,
      };
    }

    // Normal stock - hard reservation mode
    return {
      mode: RESERVATION_MODES.HARD,
      totalAvailable: available,
      totalReserved: reserved,
    };
  }

  /**
   * Check stock level for cart-time validation (no reservation)
   * Only blocks if completely sold out (totalInventory === 0)
   * Returns warnings for low stock but allows the add operation
   */
  async checkStockLevel(variantId: string): Promise<{
    canAdd: boolean;
    totalInventory: number;
    isLowStock: boolean;
    warning?: string;
  }> {
    const available = (await this.getAvailableInventory(variantId)) || 0;

    // Only block if completely sold out
    if (available === 0) {
      return { canAdd: false, totalInventory: 0, isLowStock: true };
    }

    const isLowStock = available <= INVENTORY_THRESHOLDS.LOW_STOCK_THRESHOLD;
    return {
      canAdd: true,
      totalInventory: available,
      isLowStock,
      warning: isLowStock
        ? `Low stock! Only ${available} available.`
        : undefined,
    };
  }

  /**
   * Calculate reservation TTL based on inventory level
   */
  private calculateReservationTTL(inventory: number): number {
    if (inventory > 10) return RESERVATION_TTL_TIERS.HIGH_STOCK;
    if (inventory >= 4) return RESERVATION_TTL_TIERS.MEDIUM_STOCK;
    return RESERVATION_TTL_TIERS.LOW_STOCK;
  }

  /**
   * Reserve inventory with automatic mode detection
   */
  async reserveInventoryWithMode(
    cartId: string,
    variantId: string,
    quantity: number,
    ttlSeconds?: number,
  ): Promise<{ mode: ReservationMode; warning?: string }> {
    if (!this.reserveInventoryScriptSha) {
      throw new Error("Reservation Lua script not loaded");
    }

    const reservationInfo = await this.determineReservationMode(variantId);

    if (reservationInfo.mode === RESERVATION_MODES.WAITLIST) {
      throw new BadRequestException("Out of stock. Join waitlist instead.");
    }

    // Use dynamic TTL if not provided
    const dynamicTtl =
      ttlSeconds ??
      this.calculateReservationTTL(reservationInfo.totalAvailable);

    const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variantId);
    const reservedKey = KEY_PATTERNS.INVENTORY_RESERVED(variantId);
    const reservationKey = KEY_PATTERNS.INVENTORY_RESERVATION(
      cartId,
      variantId,
    );
    const softReservedKey = `inventory:soft_reserved:${variantId}`;

    try {
      // Call Lua script with mode (4 keys for soft reservation counter)
      const result = await this.client.evalsha(
        this.reserveInventoryScriptSha,
        4,
        inventoryKey,
        reservedKey,
        reservationKey,
        softReservedKey,
        quantity.toString(),
        dynamicTtl.toString(),
        reservationInfo.mode, // Pass mode to Lua
        (reservationInfo.softLimit || 0).toString(),
      );

      // Handle Lua script result
      if (Array.isArray(result) && result[0] === "err") {
        if (result[1] === "INSUFFICIENT_INVENTORY") {
          const available = result[2] as number;
          throw new BadRequestException(
            `Insufficient inventory. Available: ${available}`,
          );
        }
        throw new Error(`Reservation failed: ${result[1]}`);
      }

      this.logger.debug(
        createLogContext(this.contextService, "reserveInventoryWithMode", {
          cartId,
          variantId,
          quantity,
          mode: reservationInfo.mode,
        }),
        `Reserved ${quantity} units of inventory for cart ${cartId}, variant ${variantId} (mode: ${reservationInfo.mode})`,
      );

      // Return warning for soft reservations
      const warning =
        reservationInfo.mode === RESERVATION_MODES.SOFT
          ? `Low stock! Only ${reservationInfo.totalAvailable} available. Complete checkout quickly.`
          : undefined;

      return { mode: reservationInfo.mode, warning };
    } catch (error) {
      // Increment failed reservations counter
      try {
        await this.client.incr("inventory:failed_reservations");
      } catch {
        // Ignore counter increment errors
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        createErrorContext(
          this.contextService,
          "reserveInventoryWithMode",
          error,
          { cartId, variantId, quantity },
        ),
        `Failed to reserve inventory for cart ${cartId}, variant ${variantId}`,
      );
      throw error;
    }
  }

  /**
   * Refresh TTL for a reservation
   */
  async refreshReservationTTL(
    cartId: string,
    variantId: string,
    ttlSeconds: number = TTL.INVENTORY_RESERVATION,
  ): Promise<void> {
    const reservationKey = KEY_PATTERNS.INVENTORY_RESERVATION(
      cartId,
      variantId,
    );
    try {
      const exists = await this.exists(reservationKey);
      if (exists) {
        await this.client.expire(reservationKey, ttlSeconds);
        this.logger.debug(
          `Refreshed TTL for reservation cart ${cartId}, variant ${variantId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to refresh TTL for reservation cart ${cartId}, variant ${variantId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Release reserved inventory (returns to available)
   * Use this for cart removals or TTL expiry
   */
  async releaseInventory(variantId: string, quantity: number): Promise<void> {
    const reservedKey = KEY_PATTERNS.INVENTORY_RESERVED(variantId);
    try {
      const currentReserved = await this.getReservedInventory(variantId);
      const releaseAmount = Math.min(quantity, currentReserved);

      if (releaseAmount > 0) {
        // Use atomic decrement
        await this.client.decrby(reservedKey, releaseAmount);
        this.logger.debug(
          `Released ${releaseAmount} units of inventory for variant ${variantId}`,
        );
      } else {
        this.logger.debug(
          `No inventory to release for variant ${variantId}. Requested: ${quantity}, Reserved: ${currentReserved}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to release inventory for variant ${variantId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Commit reservation (convert reserved → consumed)
   * Use this when an order is created to consume the reserved inventory
   * This releases the reservation AND decrements available inventory
   */
  async commitReservation(variantId: string, quantity: number): Promise<void> {
    try {
      // Release reservation (decrement reserved count)
      await this.releaseInventory(variantId, quantity);
      // Decrement available inventory (consume the inventory)
      await this.incrementInventory(variantId, -quantity);
      this.logger.debug(
        `Committed ${quantity} units of reserved inventory for variant ${variantId} (converted to consumed)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to commit reservation for variant ${variantId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Get available inventory count
   */
  /**
   * Get available inventory count
   * If Redis doesn't have the value, syncs from database
   */
  async getAvailableInventory(variantId: string): Promise<number | null> {
    const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variantId);
    try {
      const value = await this.client.get(inventoryKey);
      if (value === null) {
        // Redis doesn't have the value - sync from database
        await this.syncInventoryFromDatabase(variantId);
        // Try again after sync
        const syncedValue = await this.client.get(inventoryKey);
        if (syncedValue === null) {
          return null;
        }
        return parseInt(syncedValue, 10);
      }
      return parseInt(value, 10);
    } catch (error) {
      this.logger.error(
        `Failed to get available inventory for variant ${variantId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Sync inventory from database to Redis
   * Called when Redis doesn't have the inventory value
   */
  async syncInventoryFromDatabase(variantId: string): Promise<void> {
    try {
      const { eq, productVariants } = await import("@vcecom/db");

      const [variant] = await this.db
        .select({ inventory: productVariants.inventory })
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .limit(1);

      if (variant) {
        await this.setInventory(variantId, variant.inventory);
        this.logger.debug(
          `Synced inventory for variant ${variantId} from database: ${variant.inventory}`,
        );
      } else {
        this.logger.warn(
          `Variant ${variantId} not found in database during inventory sync`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync inventory from database for variant ${variantId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      // Don't throw - allow the system to continue
    }
  }

  /**
   * Set inventory count (for sync with DB)
   */
  async setInventory(variantId: string, quantity: number): Promise<void> {
    const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variantId);
    try {
      await this.client.set(inventoryKey, quantity.toString());
      this.logger.debug(
        `Set inventory for variant ${variantId} to ${quantity}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to set inventory for variant ${variantId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Sync all inventory from database to Redis
   * Bulk operation to ensure Redis cache is up to date
   */
  async syncAllInventoryFromDatabase(): Promise<{
    synced: number;
    errors: number;
  }> {
    // Ensure Redis client is initialized
    if (!this.client) {
      this.client = await this.redisStoreService.getClient();
    }

    let synced = 0;
    let errors = 0;

    try {
      const { productVariants } = await import("@vcecom/db");

      // Get all variants with inventory from database
      const variants = await this.db
        .select({
          id: productVariants.id,
          inventory: productVariants.inventory,
        })
        .from(productVariants);

      if (variants.length === 0) {
        this.logger.debug(
          createLogContext(
            this.contextService,
            "syncAllInventoryFromDatabase",
            {
              synced: 0,
              errors: 0,
            },
          ),
          "No variants found to sync",
        );
        return { synced: 0, errors: 0 };
      }

      // Use pipeline for efficient bulk operations
      const pipeline = this.client.pipeline();

      for (const variant of variants) {
        const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variant.id);
        pipeline.set(inventoryKey, variant.inventory.toString());
      }

      const results = await pipeline.exec();

      // Count successes and errors
      if (results) {
        for (const [error] of results) {
          if (error) {
            errors++;
          } else {
            synced++;
          }
        }
      } else {
        synced = variants.length;
      }

      this.logger.debug(
        createLogContext(this.contextService, "syncAllInventoryFromDatabase", {
          synced,
          errors,
          total: variants.length,
        }),
        `Synced ${synced} variant inventories from database to Redis`,
      );

      return { synced, errors };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "syncAllInventoryFromDatabase",
          error,
        ),
        "Failed to sync all inventory from database",
      );
      throw error;
    }
  }

  /**
   * Increment/decrement inventory (Redis only)
   */
  async incrementInventory(variantId: string, delta: number): Promise<number> {
    const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variantId);
    try {
      const newValue = await this.client.incrby(inventoryKey, delta);
      this.logger.debug(
        `Incremented inventory for variant ${variantId} by ${delta}. New value: ${newValue}`,
      );
      return newValue;
    } catch (error) {
      this.logger.error(
        `Failed to increment inventory for variant ${variantId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Decrement inventory in both Redis and database
   * Used when orders are placed to ensure both systems stay in sync
   * Updates Redis first (for real-time availability), then database (for persistence)
   * If database update fails, logs critical error but doesn't throw (order already created)
   */
  async decrementInventoryInDatabase(
    variantId: string,
    quantity: number,
  ): Promise<number> {
    const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variantId);
    let newRedisValue: number;

    try {
      // First, update Redis (source of truth for real-time checks)
      newRedisValue = await this.client.incrby(inventoryKey, -quantity);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "decrementInventoryInDatabase.redis",
          error,
          { variantId, quantity },
        ),
        `CRITICAL: Failed to decrement inventory in Redis for variant ${variantId}`,
      );
      throw error; // Redis failure is critical - throw to prevent order completion
    }

    // Then, update database (for persistence)
    try {
      const { eq, productVariants } = await import("@vcecom/db");
      const [updated] = await this.db
        .update(productVariants)
        .set({
          inventory: newRedisValue,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, variantId))
        .returning({ inventory: productVariants.inventory });

      this.logger.debug(
        createLogContext(this.contextService, "decrementInventoryInDatabase", {
          variantId,
          quantity,
          newRedisValue,
          newDbValue: updated.inventory,
        }),
        `Decremented inventory for variant ${variantId} by ${quantity} in both Redis and database`,
      );

      return newRedisValue;
    } catch (error) {
      // Database update failed - log as critical but don't throw
      // Order is already created, Redis is updated, but DB is out of sync
      // The periodic sync will eventually overwrite Redis with stale DB values
      // This needs manual reconciliation
      this.logger.error(
        createErrorContext(
          this.contextService,
          "decrementInventoryInDatabase.database",
          error,
          { variantId, quantity, newRedisValue },
        ),
        `CRITICAL: Failed to decrement inventory in database for variant ${variantId}. Redis updated to ${newRedisValue} but database is out of sync. Manual reconciliation required.`,
      );
      // Return Redis value even though DB update failed
      // The order is already created, so we can't rollback
      return newRedisValue;
    }
  }

  /**
   * Increment inventory in both Redis and database
   * Used when orders are cancelled to restore inventory
   * Updates Redis first (for real-time availability), then database (for persistence)
   * If database update fails, logs critical error but doesn't throw (order already cancelled)
   */
  async incrementInventoryInDatabase(
    variantId: string,
    quantity: number,
  ): Promise<number> {
    const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variantId);
    let newRedisValue: number;

    try {
      // First, update Redis (source of truth for real-time checks)
      newRedisValue = await this.client.incrby(inventoryKey, quantity);
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "incrementInventoryInDatabase.redis",
          error,
          { variantId, quantity },
        ),
        `CRITICAL: Failed to increment inventory in Redis for variant ${variantId}`,
      );
      throw error; // Redis failure is critical - throw to prevent cancellation completion
    }

    // Then, update database (for persistence)
    try {
      const { eq, productVariants } = await import("@vcecom/db");
      const [updated] = await this.db
        .update(productVariants)
        .set({
          inventory: newRedisValue,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, variantId))
        .returning({ inventory: productVariants.inventory });

      this.logger.debug(
        createLogContext(this.contextService, "incrementInventoryInDatabase", {
          variantId,
          quantity,
          newRedisValue,
          newDbValue: updated.inventory,
        }),
        `Incremented inventory for variant ${variantId} by ${quantity} in both Redis and database`,
      );

      return newRedisValue;
    } catch (error) {
      // Database update failed - log as critical but don't throw
      // Order is already cancelled, Redis is updated, but DB is out of sync
      // The periodic sync will eventually overwrite Redis with stale DB values
      // This needs manual reconciliation
      this.logger.error(
        createErrorContext(
          this.contextService,
          "incrementInventoryInDatabase.database",
          error,
          { variantId, quantity, newRedisValue },
        ),
        `CRITICAL: Failed to increment inventory in database for variant ${variantId}. Redis updated to ${newRedisValue} but database is out of sync. Manual reconciliation required.`,
      );
      // Return Redis value even though DB update failed
      // The order is already cancelled, so we can't rollback
      return newRedisValue;
    }
  }

  /**
   * Sync Redis inventory value to database without modifying Redis
   * Used after commitReservationAtomic to ensure database stays in sync
   * Reads current value from Redis and updates database
   * If database update fails, logs warning but doesn't throw (Redis is source of truth)
   */
  async syncInventoryToDatabase(variantId: string): Promise<void> {
    const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variantId);

    try {
      // Read current inventory value from Redis
      const redisValue = await this.client.get(inventoryKey);
      const inventoryValue = redisValue ? parseInt(redisValue, 10) : 0;

      // Update database with Redis value
      const { eq, productVariants } = await import("@vcecom/db");
      const [updated] = await this.db
        .update(productVariants)
        .set({
          inventory: inventoryValue,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, variantId))
        .returning({ inventory: productVariants.inventory });

      this.logger.debug(
        createLogContext(this.contextService, "syncInventoryToDatabase", {
          variantId,
          redisValue: inventoryValue,
          dbValue: updated.inventory,
        }),
        `Synced inventory for variant ${variantId} from Redis (${inventoryValue}) to database`,
      );
    } catch (error) {
      // Database sync failed - log as warning but don't throw
      // Redis is source of truth, database sync can be retried via reconciliation job
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "syncInventoryToDatabase",
          error,
          { variantId },
        ),
        `Failed to sync inventory to database for variant ${variantId}. Redis remains source of truth.`,
      );
      // Don't throw - order creation should continue
    }
  }

  /**
   * Get reserved inventory count
   */
  async getReservedInventory(variantId: string): Promise<number> {
    const reservedKey = KEY_PATTERNS.INVENTORY_RESERVED(variantId);
    try {
      const value = await this.client.get(reservedKey);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      this.logger.error(
        `Failed to get reserved inventory for variant ${variantId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Get all reservations for a cart
   */
  async getCartReservations(
    cartId: string,
  ): Promise<Array<{ variantId: string; quantity: number }>> {
    const pattern = KEY_PATTERNS.INVENTORY_RESERVATION(cartId, "*");
    const reservations: Array<{ variantId: string; quantity: number }> = [];

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

        for (const key of keys) {
          // Extract variantId from key: inventory:reservation:{cartId}:{variantId}
          const parts = key.split(":");
          if (
            parts.length === 4 &&
            parts[0] === "inventory" &&
            parts[1] === "reservation"
          ) {
            const variantId = parts[3];
            const quantityStr = await this.client.get(key);
            if (quantityStr) {
              reservations.push({
                variantId,
                quantity: parseInt(quantityStr, 10),
              });
            }
          }
        }
      } while (cursor !== "0");

      return reservations;
    } catch (error) {
      this.logger.error(
        `Failed to get cart reservations for cart ${cartId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Release all reservations for a cart
   */
  async releaseCartReservations(cartId: string): Promise<void> {
    const reservations = await this.getCartReservations(cartId);

    for (const reservation of reservations) {
      const reservationKey = KEY_PATTERNS.INVENTORY_RESERVATION(
        cartId,
        reservation.variantId,
      );

      // Use quantity directly from getCartReservations result (already contains quantity)
      if (reservation.quantity > 0) {
        // Delete individual reservation
        await this.delete(reservationKey);
        // Decrement aggregated reserved count
        await this.releaseInventory(
          reservation.variantId,
          reservation.quantity,
        );
        this.logger.debug(
          `Released ${reservation.quantity} units for cart ${cartId}, variant ${reservation.variantId}`,
        );
      }
    }
  }

  /**
   * Get a specific reservation
   */
  async getReservation(
    cartId: string,
    variantId: string,
  ): Promise<number | null> {
    const reservationKey = KEY_PATTERNS.INVENTORY_RESERVATION(
      cartId,
      variantId,
    );
    try {
      const value = await this.client.get(reservationKey);
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      this.logger.error(
        `Failed to get reservation for cart ${cartId}, variant ${variantId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  /**
   * Atomically release a reservation using Lua script
   * Releases both cart-level and global counters atomically
   * @param cartId - Cart ID
   * @param variantId - Variant ID
   * @param mode - Reservation mode ('hard' or 'soft')
   */
  async releaseInventoryAtomic(
    cartId: string,
    variantId: string,
    mode: ReservationMode,
  ): Promise<void> {
    if (!this.releaseInventoryScriptSha) {
      this.logger.error("Release inventory Lua script not loaded.");
      throw new Error("Release inventory Lua script not available");
    }

    const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variantId);
    const reservedKey = KEY_PATTERNS.INVENTORY_RESERVED(variantId);
    const reservationKey = KEY_PATTERNS.INVENTORY_RESERVATION(
      cartId,
      variantId,
    );
    const softReservedKey = KEY_PATTERNS.INVENTORY_SOFT_RESERVED(variantId);

    try {
      const result = await this.client.evalsha(
        this.releaseInventoryScriptSha,
        4,
        inventoryKey,
        reservedKey,
        reservationKey,
        softReservedKey,
        mode,
      );

      // Lua script returns indexed array: ['ok', released, reserved, available]
      if (Array.isArray(result) && result.length >= 2 && result[0] === "ok") {
        const released = result[1] as number;
        const reserved = result[2] as number;
        const available = result[3] as number;
        this.logger.debug(
          createLogContext(this.contextService, "releaseInventoryAtomic", {
            cartId,
            variantId,
            mode,
            released,
            reserved,
            available,
          }),
          `Released ${released} units atomically for cart ${cartId}, variant ${variantId}. Reserved: ${reserved}, Available: ${available}`,
        );
      } else {
        this.logger.warn(
          createLogContext(this.contextService, "releaseInventoryAtomic", {
            cartId,
            variantId,
            mode,
            result,
          }),
          `Release inventory script returned unexpected result for cart ${cartId}, variant ${variantId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "releaseInventoryAtomic",
          error,
          { cartId, variantId, mode },
        ),
        `Failed to atomically release inventory for cart ${cartId}, variant ${variantId}`,
      );
      throw error;
    }
  }

  /**
   * Validate inventory availability using Redis-only validation Lua script
   * Reads ONLY from Redis, never touches DB
   * @param cartId - Cart ID
   * @param variantId - Variant ID
   * @param quantity - Quantity to validate
   * @returns Validation result with available inventory count
   */
  async validateInventoryAvailability(
    cartId: string,
    variantId: string,
    quantity: number,
  ): Promise<{
    valid: boolean;
    available: number;
    requested: number;
  }> {
    if (!this.validateInventoryScriptSha) {
      this.logger.error("Validate inventory Lua script not loaded.");
      throw new Error("Validate inventory Lua script not available");
    }

    const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variantId);
    const reservedKey = KEY_PATTERNS.INVENTORY_RESERVED(variantId);
    const reservationKey = KEY_PATTERNS.INVENTORY_RESERVATION(
      cartId,
      variantId,
    );

    try {
      const result = await this.client.evalsha(
        this.validateInventoryScriptSha,
        3,
        inventoryKey,
        reservedKey,
        reservationKey,
        quantity.toString(),
      );

      // Lua script returns indexed array: [valid (0 or 1), available, requested]
      if (!Array.isArray(result) || result.length < 3) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "validateInventoryAvailability",
            new Error("Invalid Lua script response"),
            { cartId, variantId, result },
          ),
          `Invalid Lua script response for cart ${cartId}, variant ${variantId}`,
        );
        return {
          valid: false,
          available: 0,
          requested: quantity,
        };
      }

      return {
        valid: result[0] === 1,
        available: result[1] as number,
        requested: result[2] as number,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateInventoryAvailability",
          error,
          { cartId, variantId, quantity },
        ),
        `Failed to validate inventory availability for cart ${cartId}, variant ${variantId}`,
      );
      throw error;
    }
  }

  /**
   * Atomically reacquire inventory for checkout
   * Validates availability, clears old reservation, creates new reservation with checkout TTL, and sets checkout lock
   * @param cartId - Cart ID
   * @param variantId - Variant ID
   * @param requestedQuantity - Quantity to reacquire
   * @param checkoutTTL - TTL for checkout reservation (default: 120s)
   * @returns Reacquisition result with validity, reacquired quantity, and available inventory
   */
  async reacquireInventoryAtomic(
    cartId: string,
    variantId: string,
    requestedQuantity: number,
    checkoutTTL: number = CHECKOUT_LOCK_TTL,
  ): Promise<{
    valid: boolean;
    reacquired?: number;
    available?: number;
    requested: number;
    reason?: string;
  }> {
    if (!this.reacquireInventoryScriptSha) {
      this.logger.error("Reacquire inventory Lua script not loaded.");
      throw new Error("Reacquire inventory Lua script not available");
    }

    const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variantId);

    // Ensure inventory exists in Redis before running Lua script
    // This prevents false "out of stock" errors when Redis cache is missing the key
    const inventoryExists = await this.client.exists(inventoryKey);

    // ENHANCED LOGGING: Log current Redis state
    const currentInventory = await this.client.get(inventoryKey);
    const reservedKey = KEY_PATTERNS.INVENTORY_RESERVED(variantId);
    const currentReserved = await this.client.get(reservedKey);
    const reservationKey = KEY_PATTERNS.INVENTORY_RESERVATION(
      cartId,
      variantId,
    );
    const currentReservation = await this.client.get(reservationKey);

    this.logger.info(
      createLogContext(
        this.contextService,
        "reacquireInventoryAtomic.preCheck",
        {
          cartId,
          variantId,
          requestedQuantity,
          inventoryExists,
          currentInventory: currentInventory
            ? parseInt(currentInventory, 10)
            : null,
          currentReserved: currentReserved ? parseInt(currentReserved, 10) : 0,
          currentReservation: currentReservation
            ? parseInt(currentReservation, 10)
            : 0,
        },
      ),
      `Pre-check: variantId=${variantId}, inventory=${currentInventory}, reserved=${currentReserved}, cartReservation=${currentReservation}, requested=${requestedQuantity}`,
    );

    if (inventoryExists === 0) {
      this.logger.warn(
        createLogContext(this.contextService, "reacquireInventoryAtomic", {
          cartId,
          variantId,
          requestedQuantity,
        }),
        `Inventory key missing for variant ${variantId}, syncing from database`,
      );

      // Sync from database
      await this.syncInventoryFromDatabase(variantId);

      // Verify sync worked
      const syncedValue = await this.client.get(inventoryKey);
      if (syncedValue === null) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "reacquireInventoryAtomic",
            new Error("Inventory sync failed"),
            { cartId, variantId },
          ),
          `Failed to sync inventory for variant ${variantId}`,
        );
        return {
          valid: false,
          available: 0,
          requested: requestedQuantity,
          reason: "INVENTORY_SYNC_FAILED",
        };
      }

      this.logger.info(
        createLogContext(this.contextService, "reacquireInventoryAtomic", {
          cartId,
          variantId,
          syncedInventory: syncedValue,
        }),
        `Successfully synced inventory for variant ${variantId}: ${syncedValue} units`,
      );
    }

    const reservedKeyFinal = KEY_PATTERNS.INVENTORY_RESERVED(variantId);
    const reservationKeyFinal = KEY_PATTERNS.INVENTORY_RESERVATION(
      cartId,
      variantId,
    );
    const checkoutLockKey = KEY_PATTERNS.CHECKOUT_LOCK(cartId);

    try {
      const result = await this.client.evalsha(
        this.reacquireInventoryScriptSha,
        4,
        inventoryKey,
        reservedKeyFinal,
        reservationKeyFinal,
        checkoutLockKey,
        requestedQuantity.toString(),
        checkoutTTL.toString(),
      );

      // Lua script returns indexed array (ioredis cannot parse associative tables):
      // On failure: [0, actuallyAvailable, requested]
      // On success: [1, reacquired, newAvailable, newReserved]
      if (!Array.isArray(result) || result.length < 3) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "reacquireInventoryAtomic",
            new Error("Invalid Lua script response"),
            { cartId, variantId, result },
          ),
          `Invalid Lua script response for cart ${cartId}, variant ${variantId}`,
        );
        return {
          valid: false,
          available: 0,
          requested: requestedQuantity,
          reason: "SCRIPT_ERROR",
        };
      }

      const valid = result[0] === 1;

      if (valid) {
        // Success: [1, reacquired, newAvailable, newReserved]
        const reacquired = result[1] as number;
        const available = result[2] as number;
        const reserved = result[3] as number;

        this.logger.info(
          createLogContext(
            this.contextService,
            "reacquireInventoryAtomic.SUCCESS",
            {
              cartId,
              variantId,
              requestedQuantity,
              reacquired,
              available,
              reserved,
            },
          ),
          `Reacquired ${reacquired} units for cart ${cartId}, variant ${variantId}. Available: ${available}, Reserved: ${reserved}`,
        );

        return {
          valid: true,
          reacquired,
          available,
          requested: requestedQuantity,
        };
      } else {
        // Failure: [0, actuallyAvailable, requested]
        const available = result[1] as number;
        const requested = result[2] as number;

        this.logger.warn(
          createLogContext(
            this.contextService,
            "reacquireInventoryAtomic.FAILED",
            {
              cartId,
              variantId,
              requestedQuantity,
              available,
              requested,
            },
          ),
          `CHECKOUT BLOCKED: Reacquisition failed for cart ${cartId}, variant ${variantId}. Available: ${available}, Requested: ${requested}`,
        );

        return {
          valid: false,
          available,
          requested,
          reason: "INSUFFICIENT_INVENTORY",
        };
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "reacquireInventoryAtomic",
          error,
          { cartId, variantId, requestedQuantity },
        ),
        `Failed to atomically reacquire inventory for cart ${cartId}, variant ${variantId}`,
      );
      throw error;
    }
  }

  /**
   * Atomically commit a reservation (convert reserved → consumed)
   * Releases reservation AND decrements inventory in single atomic operation
   * @param cartId - Cart ID
   * @param variantId - Variant ID
   * @param quantity - Quantity to commit
   * @param mode - Reservation mode ('hard' or 'soft')
   * @returns New inventory count after commit
   */
  async commitReservationAtomic(
    cartId: string,
    variantId: string,
    quantity: number,
    mode: ReservationMode,
  ): Promise<number> {
    if (!this.commitReservationScriptSha) {
      this.logger.error("Commit reservation Lua script not loaded.");
      throw new Error("Commit reservation Lua script not available");
    }

    const inventoryKey = KEY_PATTERNS.INVENTORY_VARIANT(variantId);
    const reservedKey = KEY_PATTERNS.INVENTORY_RESERVED(variantId);
    const reservationKey = KEY_PATTERNS.INVENTORY_RESERVATION(
      cartId,
      variantId,
    );
    const softReservedKey = KEY_PATTERNS.INVENTORY_SOFT_RESERVED(variantId);

    try {
      const result = await this.client.evalsha(
        this.commitReservationScriptSha,
        4,
        inventoryKey,
        reservedKey,
        reservationKey,
        softReservedKey,
        quantity.toString(),
        mode,
      );

      // Lua script returns indexed array:
      // On success: ['ok', newInventory, reserved, released]
      // On error: ['err', errorType, expected/actual, quantity]
      if (Array.isArray(result) && result.length >= 2 && result[0] === "ok") {
        const newInventory = result[1] as number;
        const reserved = result[2] as number;
        const released = result[3] as number;
        this.logger.debug(
          createLogContext(this.contextService, "commitReservationAtomic", {
            cartId,
            variantId,
            quantity,
            mode,
            newInventory,
            reserved,
            released,
          }),
          `Committed ${quantity} units atomically for cart ${cartId}, variant ${variantId}. New inventory: ${newInventory}, Reserved: ${reserved}`,
        );
        return newInventory;
      } else if (
        Array.isArray(result) &&
        result.length >= 2 &&
        result[0] === "err"
      ) {
        const errorType = result[1] as string;
        const errorDetails = result.length > 2 ? result[2] : undefined;
        this.logger.error(
          createErrorContext(
            this.contextService,
            "commitReservationAtomic",
            new Error(errorType),
            { cartId, variantId, quantity, mode, errorType, errorDetails },
          ),
          `Commit reservation failed: ${errorType}`,
        );
        throw new Error(`Commit reservation failed: ${errorType}`);
      } else {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "commitReservationAtomic",
            new Error("Unexpected result"),
            { cartId, variantId, quantity, mode, result },
          ),
          `Commit reservation script returned unexpected result`,
        );
        throw new Error("Commit reservation returned unexpected result");
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "commitReservationAtomic",
          error,
          { cartId, variantId, quantity, mode },
        ),
        `Failed to atomically commit reservation for cart ${cartId}, variant ${variantId}`,
      );
      throw error;
    }
  }

  /**
   * Reconcile reservations (for recovery after Redis restart)
   * Detects and fixes:
   * - Expired reservations (releases them via aggregated count correction)
   * - Orphaned reservations (missing TTL)
   * - Negative reserved counts
   * - Impossible states (reserved > total inventory)
   * - Aggregated counter mismatches
   */
  async reconcileReservations(): Promise<{
    released: number;
    inconsistencies: number;
    orphaned: number;
    negativeCorrections: number;
    variantsProcessed: number;
  }> {
    // Ensure Redis client is initialized before proceeding
    // This handles the case where reconcileReservations() is called before onModuleInit() completes
    if (!this.client) {
      this.client = await this.redisStoreService.getClient();
    }

    let released = 0;
    let inconsistencies = 0;
    let orphaned = 0;
    let negativeCorrections = 0;
    const processedVariants = new Set<string>();

    try {
      // Scan for all active reservation keys
      const reservationKeys = await scanKeys(
        this.client,
        "inventory:reservation:*",
      );

      // Process orphaned reservations and group valid ones by variant
      const { orphanedCount, releasesByVariant } =
        await processOrphanedReservations(
          this.client,
          this.logger,
          reservationKeys,
        );
      orphaned = orphanedCount;

      const variantReservations = await groupReservationsByVariant(
        this.client,
        reservationKeys,
      );

      // Scan for all variants with aggregated reserved counts
      const reservedKeys = await scanKeys(this.client, "inventory:reserved:*");

      // Process each variant with aggregated reserved count
      for (const reservedKey of reservedKeys) {
        const variantId = parseReservedKey(reservedKey);
        if (!variantId) {
          continue;
        }

        processedVariants.add(variantId);
        const actualReserved = await this.getReservedInventory(variantId);
        const totalInventory =
          (await this.getAvailableInventory(variantId)) || 0;
        const activeReservations = variantReservations.get(variantId) || [];
        const expectedReserved =
          calculateTotalReservedFromReservations(activeReservations);

        // Fix negative reserved count
        const negativeCorrectionsCount = await fixNegativeReservedCount(
          this.client,
          this.logger,
          variantId,
          actualReserved,
        );
        negativeCorrections += negativeCorrectionsCount;

        // Re-read after potential correction
        const currentReserved = await this.getReservedInventory(variantId);

        // Fix impossible state (reserved > total inventory)
        const impossibleStateCorrections = await fixImpossibleReservedState(
          this.client,
          this.logger,
          variantId,
          currentReserved,
          totalInventory,
        );
        negativeCorrections += impossibleStateCorrections;

        // Fix inconsistency between expected and actual reserved counts
        const finalReserved = await this.getReservedInventory(variantId);
        const inconsistencyResult = await fixReservationInconsistency(
          this.client,
          this.logger,
          variantId,
          expectedReserved,
          finalReserved,
        );
        released += inconsistencyResult.released;
        inconsistencies += inconsistencyResult.inconsistencies;
      }

      // Process variants that have active reservations but no aggregated count yet
      for (const [variantId, reservations] of variantReservations.entries()) {
        if (!processedVariants.has(variantId)) {
          processedVariants.add(variantId);
          const expectedReserved =
            calculateTotalReservedFromReservations(reservations);
          const actualReserved = await this.getReservedInventory(variantId);

          const inconsistencyResult = await fixReservationInconsistency(
            this.client,
            this.logger,
            variantId,
            expectedReserved,
            actualReserved,
          );
          inconsistencies += inconsistencyResult.inconsistencies;
        }
      }

      // Release orphaned reservations (decrement aggregated count)
      for (const [variantId, orphanedQuantity] of releasesByVariant.entries()) {
        const releasedQuantity = await releaseOrphanedReservations(
          this.client,
          this.logger,
          variantId,
          orphanedQuantity,
          (vid, qty) => this.releaseInventory(vid, qty),
        );
        released += releasedQuantity;
      }

      this.logger.info(
        createLogContext(this.contextService, "reconcileReservations", {
          released,
          inconsistencies,
          orphaned,
          negativeCorrections,
          variantsProcessed: processedVariants.size,
        }),
        "Reservation reconciliation complete",
      );

      return {
        released,
        inconsistencies,
        orphaned,
        negativeCorrections,
        variantsProcessed: processedVariants.size,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "reconcileReservations", error),
        "Failed to reconcile reservations",
      );
      throw error;
    }
  }
}
