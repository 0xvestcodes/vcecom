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
 */
function loadLuaScript(scriptName: string, currentDir: string): string {
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

        // Load Lua script with timeout to avoid blocking startup
        const script = loadLuaScript("reserve-inventory.lua", __dirname);
        // Use Promise.race to add timeout for script loading
        this.reserveInventoryScriptSha = (await Promise.race([
          this.client.script("LOAD", script),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("Script load timeout")), 2000),
          ),
        ])) as string;
        this.logger.info(
          createLogContext(this.contextService, "onModuleInit", {
            scriptName: "reserve-inventory.lua",
          }),
          "Reservation Lua script loaded successfully",
        );
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

    try {
      const result = await this.client.evalsha(
        this.reserveInventoryScriptSha,
        3,
        inventoryKey,
        reservedKey,
        reservationKey,
        quantity.toString(),
        ttlSeconds.toString(),
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
  private async syncInventoryFromDatabase(variantId: string): Promise<void> {
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
   * Increment/decrement inventory
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
      const quantity = await this.getReservation(cartId, reservation.variantId);

      if (quantity !== null && quantity > 0) {
        // Delete individual reservation
        await this.delete(reservationKey);
        // Decrement aggregated reserved count
        await this.releaseInventory(reservation.variantId, quantity);
        this.logger.debug(
          `Released ${quantity} units for cart ${cartId}, variant ${reservation.variantId}`,
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
