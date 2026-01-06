import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { collections, eq, products, sql } from "@vcecom/db";
import { and, SQL } from "drizzle-orm";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "../../../common/config/app.config.service";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { BackgroundJobsService } from "../../admin/services/background-jobs.service";
import { DB_TOKEN } from "../../database/database.module";
import type { Database } from "../../database/db";
import { RedisStoreService } from "../../redis-store/redis-store.service";
import { SearchIndexerService } from "../search-indexer.service";

export interface ReindexOptions {
  entityType?: "products" | "collections" | "all";
  categoryId?: string;
  collectionId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  batchSize?: number;
}

export interface ReindexStatus {
  status: "idle" | "running" | "completed" | "failed";
  progress: {
    total: number;
    processed: number;
    failed: number;
    percentage: number;
  };
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

@Injectable()
export class ReindexWorkerService implements OnModuleInit {
  private readonly STATUS_KEY = "search:reindex:status";
  private isRunning = false;

  constructor(
    private readonly searchIndexer: SearchIndexerService,
    private readonly configService: AppConfigService,
    private readonly backgroundJobsService: BackgroundJobsService,
    private readonly redisStoreService: RedisStoreService,
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Initialize indexes on module init
    try {
      await this.searchIndexer.initializeIndexes();
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ReindexWorkerService.onModuleInit",
          error,
        ),
        "Failed to initialize search indexes",
      );
    }
  }

  /**
   * Start a reindex operation
   */
  async startReindex(options: ReindexOptions = {}): Promise<void> {
    if (this.isRunning) {
      throw new Error("Reindex is already running");
    }

    this.isRunning = true;

    // Record job start
    await this.backgroundJobsService.recordJobStart("search-reindex");

    try {
      const status: ReindexStatus = {
        status: "running",
        progress: {
          total: 0,
          processed: 0,
          failed: 0,
          percentage: 0,
        },
        startedAt: new Date().toISOString(),
        completedAt: null,
        error: null,
      };

      await this.saveStatus(status);

      // Determine what to reindex
      const entityType = options.entityType || "all";
      const batchSize =
        options.batchSize || this.configService.getSearchConfig().batchSize;

      if (entityType === "products" || entityType === "all") {
        await this.reindexProducts(options, batchSize);
      }

      if (entityType === "collections" || entityType === "all") {
        await this.reindexCollections(options, batchSize);
      }

      status.status = "completed";
      status.completedAt = new Date().toISOString();
      await this.saveStatus(status);

      await this.backgroundJobsService.recordJobCompletion(
        "search-reindex",
        true,
      );

      this.logger.info(
        createLogContext(
          this.contextService,
          "ReindexWorkerService.startReindex",
          { options },
        ),
        "Reindex completed successfully",
      );
    } catch (error) {
      const status = await this.getStatus();
      if (status) {
        status.status = "failed";
        status.error = error instanceof Error ? error.message : "Unknown error";
        status.completedAt = new Date().toISOString();
        await this.saveStatus(status);
      }

      await this.backgroundJobsService.recordJobCompletion(
        "search-reindex",
        false,
        error instanceof Error ? error.message : "Unknown error",
      );

      this.logger.error(
        createErrorContext(
          this.contextService,
          "ReindexWorkerService.startReindex",
          error,
          { options },
        ),
        "Reindex failed",
      );
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Reindex products
   */
  private async reindexProducts(
    options: ReindexOptions,
    batchSize: number,
  ): Promise<void> {
    // Build query conditions
    const conditions: SQL[] = [];

    if (options.categoryId) {
      conditions.push(eq(products.categoryId, options.categoryId));
    }

    if (options.dateFrom) {
      conditions.push(sql`${products.createdAt} >= ${options.dateFrom}`);
    }

    if (options.dateTo) {
      conditions.push(sql`${products.createdAt} <= ${options.dateTo}`);
    }

    // Get total count
    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;
    const totalResult = await this.db
      .select({ count: products.id })
      .from(products)
      .where(whereCondition);
    const total = totalResult.length;

    // Update status
    const status = await this.getStatus();
    if (status) {
      status.progress.total = total;
      await this.saveStatus(status);
    }

    // Process in batches
    let processed = 0;
    let failed = 0;
    let offset = 0;

    while (offset < total) {
      const productBatch = await this.db
        .select({ id: products.id })
        .from(products)
        .where(whereCondition)
        .limit(batchSize)
        .offset(offset);
      const productIds = productBatch.map((p) => p.id);

      if (productIds.length > 0) {
        try {
          const result = await this.searchIndexer.indexProducts(productIds);
          processed += result.success;
          failed += result.failed;
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "ReindexWorkerService.reindexProducts",
              error,
              { offset, batchSize },
            ),
            "Failed to index product batch",
          );
          failed += productIds.length;
        }
      }

      offset += batchSize;

      // Update progress
      if (status) {
        status.progress.processed = processed;
        status.progress.failed = failed;
        status.progress.percentage = total > 0 ? (processed / total) * 100 : 0;
        await this.saveStatus(status);
      }

      // Rate limiting - wait a bit between batches
      const rateLimit = this.configService.getSearchConfig().reindexRateLimit;
      if (rateLimit > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000 / rateLimit));
      }
    }
  }

  /**
   * Reindex collections
   */
  private async reindexCollections(
    options: ReindexOptions,
    batchSize: number,
  ): Promise<void> {
    // Build query conditions
    const conditions: SQL[] = [];

    if (options.collectionId) {
      conditions.push(eq(collections.id, options.collectionId));
    }

    if (options.dateFrom) {
      conditions.push(sql`${collections.createdAt} >= ${options.dateFrom}`);
    }

    if (options.dateTo) {
      conditions.push(sql`${collections.createdAt} <= ${options.dateTo}`);
    }

    // Get total count
    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;
    const totalResult = await this.db
      .select({ count: collections.id })
      .from(collections)
      .where(whereCondition);
    const total = totalResult.length;

    // Update status
    const status = await this.getStatus();
    if (status) {
      status.progress.total += total;
      await this.saveStatus(status);
    }

    // Process in batches
    let processed = 0;
    let failed = 0;
    let offset = 0;

    while (offset < total) {
      const collectionBatch = await this.db
        .select({ id: collections.id })
        .from(collections)
        .where(whereCondition)
        .limit(batchSize)
        .offset(offset);
      const collectionIds = collectionBatch.map((c) => c.id);

      if (collectionIds.length > 0) {
        try {
          const result =
            await this.searchIndexer.indexCollections(collectionIds);
          processed += result.success;
          failed += result.failed;
        } catch (error) {
          this.logger.error(
            createErrorContext(
              this.contextService,
              "ReindexWorkerService.reindexCollections",
              error,
              { offset, batchSize },
            ),
            "Failed to index collection batch",
          );
          failed += collectionIds.length;
        }
      }

      offset += batchSize;

      // Update progress
      if (status) {
        status.progress.processed = processed;
        status.progress.failed = failed;
        status.progress.percentage =
          status.progress.total > 0
            ? (status.progress.processed / status.progress.total) * 100
            : 0;
        await this.saveStatus(status);
      }

      // Rate limiting
      const rateLimit = this.configService.getSearchConfig().reindexRateLimit;
      if (rateLimit > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000 / rateLimit));
      }
    }
  }

  /**
   * Get current reindex status
   */
  async getStatus(): Promise<ReindexStatus | null> {
    try {
      const client = await this.redisStoreService.getClient();
      const statusJson = await client.get(this.STATUS_KEY);
      if (!statusJson) {
        return {
          status: "idle",
          progress: {
            total: 0,
            processed: 0,
            failed: 0,
            percentage: 0,
          },
          startedAt: null,
          completedAt: null,
          error: null,
        };
      }
      return JSON.parse(statusJson) as ReindexStatus;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ReindexWorkerService.getStatus",
          error,
        ),
        "Failed to get reindex status",
      );
      return null;
    }
  }

  /**
   * Save reindex status
   */
  private async saveStatus(status: ReindexStatus): Promise<void> {
    try {
      const client = await this.redisStoreService.getClient();
      await client.set(this.STATUS_KEY, JSON.stringify(status));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "ReindexWorkerService.saveStatus",
          error,
        ),
        "Failed to save reindex status",
      );
    }
  }

  /**
   * Check if reindex is currently running
   */
  isReindexRunning(): boolean {
    return this.isRunning;
  }
}
