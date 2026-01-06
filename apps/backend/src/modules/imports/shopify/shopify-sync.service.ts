import { Injectable, Optional } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { ShopifyApiClient, ShopifyConfig } from "./shopify-api.client";
import { ShopifyMapperService } from "./shopify-mapper.service";

export interface SyncStatus {
  lastSyncAt: Date | null;
  isRunning: boolean;
  lastError?: string;
}

@Injectable()
export class ShopifySyncService {
  private syncStatus: Map<string, SyncStatus> = new Map();

  constructor(
    @Optional() readonly _shopifyApiClient: ShopifyApiClient | undefined,
    readonly _shopifyMapper: ShopifyMapperService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Start periodic sync with Shopify
   */
  async startSync(
    config: ShopifyConfig,
    intervalMinutes: number = 60,
  ): Promise<void> {
    const syncKey = config.shopDomain;

    if (this.syncStatus.get(syncKey)?.isRunning) {
      throw new Error(`Sync already running for ${config.shopDomain}`);
    }

    this.syncStatus.set(syncKey, {
      lastSyncAt: null,
      isRunning: true,
    });

    // Start sync loop
    this.syncLoop(config, intervalMinutes).catch((error) => {
      this.logger.error(
        createErrorContext(this.contextService, "startSync", error, { config }),
        "Sync loop failed",
      );
      const status = this.syncStatus.get(syncKey);
      if (status) {
        status.isRunning = false;
        status.lastError =
          error instanceof Error ? error.message : String(error);
      }
    });
  }

  /**
   * Stop sync for a shop
   */
  async stopSync(shopDomain: string): Promise<void> {
    const status = this.syncStatus.get(shopDomain);
    if (status) {
      status.isRunning = false;
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(shopDomain: string): SyncStatus | undefined {
    return this.syncStatus.get(shopDomain);
  }

  /**
   * Sync loop
   */
  private async syncLoop(
    config: ShopifyConfig,
    intervalMinutes: number,
  ): Promise<void> {
    const syncKey = config.shopDomain;
    const intervalMs = intervalMinutes * 60 * 1000;

    while (this.syncStatus.get(syncKey)?.isRunning) {
      try {
        await this.performSync(config);
        const status = this.syncStatus.get(syncKey);
        if (status) {
          status.lastSyncAt = new Date();
          status.lastError = undefined;
        }
      } catch (error) {
        this.logger.error(
          createErrorContext(this.contextService, "syncLoop", error, {
            config,
          }),
          "Sync failed",
        );
        const status = this.syncStatus.get(syncKey);
        if (status) {
          status.lastError =
            error instanceof Error ? error.message : String(error);
        }
      }

      // Wait for next interval
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  /**
   * Perform a single sync operation
   */
  private async performSync(config: ShopifyConfig): Promise<void> {
    // Fetch updated products/customers since last sync
    // This is a simplified version - in production, use webhooks or incremental sync
    const client = new ShopifyApiClient(
      config,
      this.logger,
      this.contextService,
    );

    // Sync products
    let pageInfo: string | undefined;
    do {
      const result = await client.fetchProducts(250, pageInfo);
      // Process products...
      pageInfo = result.nextPageInfo;
    } while (pageInfo);

    // Sync customers
    pageInfo = undefined;
    do {
      const result = await client.fetchCustomers(250, pageInfo);
      // Process customers...
      pageInfo = result.nextPageInfo;
    } while (pageInfo);
  }
}
