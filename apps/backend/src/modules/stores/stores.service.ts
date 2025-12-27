import { Inject, Injectable } from "@nestjs/common";
import { eq, stores } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createErrorContext } from "../../common/logging/logging.helper";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import { StoreResponseDto, UpdateStoreDto } from "./dto/stores.dto";

@Injectable()
export class StoresService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Get the default store or first store
   * Uses ENV vars as source of truth for store settings
   */
  async getStore(): Promise<StoreResponseDto> {
    try {
      // Use ENV vars as source of truth
      const storeName =
        process.env.NEXT_PUBLIC_STORE_NAME ||
        process.env.STORE_NAME ||
        "Default Store";
      const storeDomain =
        process.env.NEXT_PUBLIC_STORE_DOMAIN ||
        process.env.STORE_DOMAIN ||
        "localhost";
      const storeCurrency =
        process.env.NEXT_PUBLIC_STORE_CURRENCY ||
        process.env.STORE_CURRENCY ||
        "INR";
      const storePrimaryColor =
        process.env.NEXT_PUBLIC_STORE_PRIMARY_COLOR ||
        process.env.STORE_PRIMARY_COLOR ||
        null;
      const storeLogoUrl =
        process.env.NEXT_PUBLIC_STORE_LOGO_URL ||
        process.env.STORE_LOGO_URL ||
        null;

      // Try to get default store first
      let [store] = await this.db
        .select()
        .from(stores)
        .where(eq(stores.isDefault, true))
        .limit(1);

      // If no default store, get the first one
      if (!store) {
        [store] = await this.db.select().from(stores).limit(1);
      }

      // If still no store, create a default one using ENV vars
      if (!store) {
        const [created] = await this.db
          .insert(stores)
          .values({
            name: storeName,
            domain: storeDomain,
            currency: storeCurrency,
            primaryColor: storePrimaryColor,
            logoUrl: storeLogoUrl,
            isDefault: true,
          })
          .returning();

        return this.mapToResponseDto(created);
      }

      // Return store with ENV vars overriding database values
      // This ensures ENV vars are always the source of truth
      return {
        ...this.mapToResponseDto(store),
        name: storeName,
        domain: storeDomain,
        currency: storeCurrency,
        primaryColor: storePrimaryColor,
        logoUrl: storeLogoUrl,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getStore", error),
        "Failed to get store",
      );
      throw error;
    }
  }

  /**
   * Update store metadata
   */
  async updateStore(dto: UpdateStoreDto): Promise<StoreResponseDto> {
    try {
      // Get current store (default or first)
      const currentStore = await this.getStore();

      // If setting a new default, unset all other defaults first
      if (dto.isDefault === true) {
        await this.db
          .update(stores)
          .set({ isDefault: false })
          .where(eq(stores.isDefault, true));
      }

      // Update store
      const [updated] = await this.db
        .update(stores)
        .set({
          name: dto.name ?? currentStore.name,
          domain: dto.domain ?? currentStore.domain,
          currency: dto.currency ?? currentStore.currency,
          primaryColor: dto.primaryColor ?? currentStore.primaryColor ?? null,
          logoUrl: dto.logoUrl ?? currentStore.logoUrl ?? null,
          isDefault: dto.isDefault ?? currentStore.isDefault,
          updatedAt: new Date(),
        })
        .where(eq(stores.id, currentStore.id))
        .returning();

      return this.mapToResponseDto(updated);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "updateStore", error, { dto }),
        "Failed to update store",
      );
      throw error;
    }
  }

  /**
   * Extract store ID from x-store-id header (for future use)
   */
  getStoreFromHeader(storeIdHeader?: string): string | null {
    return storeIdHeader || null;
  }

  /**
   * Map database store to response DTO
   */
  private mapToResponseDto(
    store: typeof stores.$inferSelect,
  ): StoreResponseDto {
    return {
      id: store.id,
      name: store.name,
      domain: store.domain,
      currency: store.currency,
      primaryColor: store.primaryColor || null,
      logoUrl: store.logoUrl || null,
      isDefault: store.isDefault,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };
  }
}
