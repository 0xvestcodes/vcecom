import { AsyncLocalStorage } from "node:async_hooks";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq, stores } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { ContextService } from "../logging/context.service";
import { createErrorContext } from "../logging/logging.helper";
import type { StoreContext } from "./store-context.interface";

/**
 * Service for managing store context
 * Handles store validation and context management
 * Uses AsyncLocalStorage to provide request-scoped store context
 */
@Injectable()
export class StoreContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<StoreContext>();

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Run a function within a store context
   */
  run<T>(context: StoreContext, fn: () => T): T {
    return this.asyncLocalStorage.run(context, fn);
  }

  /**
   * Get the current store context
   */
  get(): StoreContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get store ID from current context
   */
  getStoreId(): string | undefined {
    const context = this.get();
    return context?.storeId;
  }

  /**
   * Validate store exists and is active
   */
  async validateStore(storeId: string): Promise<boolean> {
    try {
      const [store] = await this.db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1);

      return !!store;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "validateStore", error, {
          storeId,
        }),
        "Failed to validate store",
      );
      return false;
    }
  }

  /**
   * Get store details
   */
  async getStore(storeId: string): Promise<StoreContext | null> {
    try {
      const [store] = await this.db
        .select({
          id: stores.id,
          name: stores.name,
          domain: stores.domain,
          currency: stores.currency,
        })
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1);

      if (!store) {
        return null;
      }

      return {
        storeId: store.id,
        storeName: store.name,
        storeDomain: store.domain,
        storeCurrency: store.currency,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getStore", error, {
          storeId,
        }),
        "Failed to get store",
      );
      return null;
    }
  }

  /**
   * Get default store ID
   * Used as fallback when store ID is not provided
   * Returns null if no store exists (allows system to work during initial setup)
   */
  async getDefaultStoreId(): Promise<string | null> {
    try {
      const [defaultStore] = await this.db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.isDefault, true))
        .limit(1);

      if (defaultStore) {
        return defaultStore.id;
      }

      // If no default store, get the first one
      const [firstStore] = await this.db
        .select({ id: stores.id })
        .from(stores)
        .limit(1);

      if (firstStore) {
        return firstStore.id;
      }

      // No store found - return null instead of throwing
      // This allows the middleware to handle it gracefully
      return null;
    } catch (error) {
      // Only log actual errors (database errors, etc.), not "no store found"
      this.logger.error(
        createErrorContext(this.contextService, "getDefaultStoreId", error),
        "Failed to get default store ID",
      );
      throw error;
    }
  }

  /**
   * Extract store ID from request header
   */
  extractStoreIdFromHeader(header?: string): string | null {
    return header || null;
  }
}
