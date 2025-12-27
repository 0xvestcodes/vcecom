import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inventoryAdjustments,
  inventorySettings,
  lte,
  or,
  orderItems,
  products,
  productVariants,
  sql,
} from "@vcecom/db";
import Redis from "ioredis";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createErrorContext } from "../../common/logging/logging.helper";
import {
  generatePaginationMetadata,
  normalizePaginationParams,
} from "../../common/utils/pagination.utils";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../notifications/types/notification.types";
import { KEY_PATTERNS } from "../redis-store/constants/key-patterns";
import { RedisStoreService } from "../redis-store/redis-store.service";
import { InventoryStore } from "../redis-store/stores/inventory-store";
import {
  AdjustInventoryDto,
  InventoryAdjustmentReason,
  InventoryAdjustmentResponseDto,
  InventoryAdjustmentType,
} from "./dto/adjust-inventory.dto";
import {
  BulkAdjustInventoryDto,
  BulkAdjustInventoryResponseDto,
  BulkAdjustmentResultDto,
} from "./dto/bulk-adjust.dto";
import { InventoryHealthResponseDto } from "./dto/inventory-health.dto";
import { InventoryItemResponseDto } from "./dto/inventory-item.dto";
import {
  InventoryLogEntryDto,
  InventoryLogsQueryDto,
  PaginatedInventoryLogsResponseDto,
} from "./dto/inventory-logs.dto";
import {
  InventoryReservationsResponseDto,
  ReservationsSummaryResponseDto,
} from "./dto/inventory-reservations.dto";
import {
  InventorySettingsResponseDto,
  UpdateInventorySettingsDto,
} from "./dto/inventory-settings.dto";
import { VariantsIndexResponseDto } from "./dto/inventory-variants-index.dto";
import {
  InventoryListItemDto,
  ListInventoryQueryDto,
  PaginatedInventoryResponseDto,
} from "./dto/list-inventory.dto";

@Injectable()
export class AdminInventoryService implements OnModuleInit {
  private redisClient!: Redis;
  private readonly SETTINGS_CACHE_TTL = 3600; // 1 hour
  private readonly LOGS_CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly redisStoreService: RedisStoreService,
    private readonly inventoryStore: InventoryStore,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly notificationsService: NotificationsService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  async onModuleInit() {
    try {
      this.redisClient = await this.redisStoreService.getClient();
    } catch (error) {
      this.logger.warn(
        `Redis client not available during initialization - will retry when Redis is available: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      // Don't throw - allow app to start without Redis
    }
  }

  /**
   * List inventory with pagination and filters
   */
  async listInventory(
    query: ListInventoryQueryDto,
  ): Promise<PaginatedInventoryResponseDto> {
    try {
      const { page, limit, offset } = normalizePaginationParams(
        query.page,
        query.limit,
      );

      // Build where conditions
      const conditions: ReturnType<typeof eq | typeof and | typeof or>[] = [];

      // Search condition (SKU or product title)
      if (query.search) {
        const searchPattern = `%${query.search}%`;
        const searchConditions = [
          ilike(productVariants.sku, searchPattern),
          ilike(products.title, searchPattern),
        ];
        conditions.push(or(...searchConditions));
      }

      // Status filter
      if (query.status) {
        conditions.push(eq(products.status, query.status));
      }

      // Category filter
      if (query.categoryId) {
        conditions.push(eq(products.categoryId, query.categoryId));
      }

      // Build query
      const baseQuery = this.db
        .select({
          variantId: productVariants.id,
          productId: productVariants.productId,
          sku: productVariants.sku,
          title: products.title,
          size: productVariants.size,
          color: productVariants.color,
          inventory: productVariants.inventory,
          updatedAt: productVariants.updatedAt,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id));

      const variantsQuery =
        conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

      // Note: Total count is approximate when lowStock/outOfStock filters are applied
      // because those filters require Redis data enrichment
      let countResult: Array<{ count: number }>;
      try {
        countResult = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined);
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "AdminInventoryService.listInventory.countVariants",
            error,
            { query },
          ),
          "Failed to count inventory variants",
        );
        throw error;
      }
      const count = countResult[0]?.count || 0;

      // Apply sorting (committed requires enrichment, so handle separately)
      const sortBy = query.sortBy || "updatedAt";
      const sortOrder = query.sortOrder || "desc";

      // For committed sorting, we need to fetch all and sort in memory
      // For other sorts, we can sort at DB level
      const needsMemorySort = sortBy === "committed";
      const orderBy = needsMemorySort
        ? sortOrder === "asc"
          ? asc(productVariants.updatedAt)
          : desc(productVariants.updatedAt)
        : sortBy === "inventory"
          ? sortOrder === "asc"
            ? asc(productVariants.inventory)
            : desc(productVariants.inventory)
          : sortOrder === "asc"
            ? asc(productVariants.updatedAt)
            : desc(productVariants.updatedAt);

      // Get results (if sorting by committed, fetch more to account for filtering)
      const fetchLimit = needsMemorySort ? Math.min(limit * 10, 1000) : limit;
      let variants: Array<{
        variantId: string;
        productId: string;
        sku: string | null;
        title: string;
        size: string | null;
        color: string | null;
        inventory: number;
        updatedAt: Date;
      }>;
      try {
        variants = await variantsQuery
          .limit(fetchLimit)
          .offset(needsMemorySort ? 0 : offset)
          .orderBy(orderBy);
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "AdminInventoryService.listInventory.selectVariants",
            error,
            { query, fetchLimit, offset },
          ),
          "Failed to fetch inventory variants",
        );
        throw error;
      }

      // Enrich with Redis data (inventory, committed, available)
      const enrichedItems: (InventoryListItemDto | null)[] = await Promise.all(
        variants.map(async (variant) => {
          const variantId = variant.variantId;
          const inventory =
            await this.inventoryStore.getAvailableInventory(variantId);
          const committed =
            await this.inventoryStore.getReservedInventory(variantId);
          const totalInventory =
            inventory !== null ? inventory : variant.inventory;
          const available = Math.max(0, totalInventory - (committed || 0));

          // Get low stock threshold
          const threshold = await this.getLowStockThreshold(variantId);
          const lowStock = available <= threshold;

          // Apply filters
          if (query.lowStock && !lowStock) {
            return null;
          }
          if (query.outOfStock && available > 0) {
            return null;
          }

          // Skip variants without SKU
          if (!variant.sku) {
            return null;
          }

          return {
            variantId,
            productId: variant.productId,
            sku: variant.sku,
            title: variant.title,
            attributes: {
              ...(variant.size && { size: variant.size }),
              ...(variant.color && { color: variant.color }),
            },
            inventory: totalInventory,
            committed: committed || 0,
            available,
            lowStock,
            updatedAt: variant.updatedAt,
          };
        }),
      );

      // Filter out nulls (from lowStock/outOfStock filters)
      let filteredItems = enrichedItems.filter(
        (item): item is InventoryListItemDto => item !== null,
      );

      // Sort by committed in memory if needed
      if (needsMemorySort) {
        filteredItems.sort((a, b) => {
          const comparison = a.committed - b.committed;
          return sortOrder === "asc" ? comparison : -comparison;
        });
        // Apply pagination after sorting
        filteredItems = filteredItems.slice(offset, offset + limit);
      }

      // Calculate pagination
      // If we have filters that require Redis (lowStock/outOfStock), total is approximate
      // Otherwise, use the DB count
      const total =
        query.lowStock || query.outOfStock ? filteredItems.length : count;
      const pagination = generatePaginationMetadata(page, limit, total);

      return {
        data: filteredItems,
        pagination,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "listInventory", error),
        "Failed to list inventory",
      );
      throw error;
    }
  }

  /**
   * Get single variant inventory details
   */
  async getInventoryItem(variantId: string): Promise<InventoryItemResponseDto> {
    try {
      // Get variant and product from DB
      const [variant] = await this.db
        .select({
          variantId: productVariants.id,
          productId: productVariants.productId,
          sku: productVariants.sku,
          size: productVariants.size,
          color: productVariants.color,
          inventory: productVariants.inventory,
          updatedAt: productVariants.updatedAt,
          title: products.title,
          description: products.description,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(productVariants.id, variantId))
        .limit(1);

      if (!variant) {
        throw new NotFoundException(`Variant with ID ${variantId} not found`);
      }

      // Get Redis data
      const inventory =
        await this.inventoryStore.getAvailableInventory(variantId);
      const committed =
        await this.inventoryStore.getReservedInventory(variantId);
      const totalInventory = inventory !== null ? inventory : variant.inventory;
      const available = Math.max(0, totalInventory - (committed || 0));

      // Get low stock threshold
      const threshold = await this.getLowStockThreshold(variantId);
      const lowStock = available <= threshold;

      // Get last adjustment
      const [lastAdjustment] = await this.db
        .select()
        .from(inventoryAdjustments)
        .where(eq(inventoryAdjustments.variantId, variantId))
        .orderBy(desc(inventoryAdjustments.createdAt))
        .limit(1);

      return {
        variantId: variant.variantId,
        productId: variant.productId,
        sku: variant.sku,
        title: variant.title,
        description: variant.description || undefined,
        attributes: {
          ...(variant.size && { size: variant.size }),
          ...(variant.color && { color: variant.color }),
        },
        inventory: totalInventory,
        committed: committed || 0,
        available,
        lowStockThreshold: threshold,
        lowStock,
        lastAdjustment: lastAdjustment
          ? {
              id: lastAdjustment.id,
              type: lastAdjustment.type,
              quantity: lastAdjustment.delta,
              reason: lastAdjustment.reason,
              createdAt: lastAdjustment.createdAt,
              actorAdminId: lastAdjustment.actorAdminId,
            }
          : undefined,
        updatedAt: variant.updatedAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        createErrorContext(this.contextService, "getInventoryItem", error, {
          variantId,
        }),
        "Failed to get inventory item",
      );
      throw error;
    }
  }

  /**
   * Adjust inventory for a single variant
   */
  async adjustInventory(
    variantId: string,
    dto: AdjustInventoryDto,
    adminId: string,
  ): Promise<InventoryAdjustmentResponseDto> {
    try {
      // Get current inventory from Redis (or DB fallback)
      const currentInventory =
        (await this.inventoryStore.getAvailableInventory(variantId)) ?? 0;

      // Calculate new quantity based on type
      let newQuantity: number;
      let delta: number;

      switch (dto.type) {
        case "increase":
          newQuantity = currentInventory + dto.quantity;
          delta = dto.quantity;
          break;
        case "decrease":
          newQuantity = Math.max(0, currentInventory - dto.quantity);
          delta = -dto.quantity;
          break;
        case "set":
          newQuantity = dto.quantity;
          delta = newQuantity - currentInventory;
          break;
        default:
          throw new BadRequestException(`Invalid adjustment type: ${dto.type}`);
      }

      if (newQuantity < 0) {
        throw new BadRequestException(
          "Inventory cannot be negative after adjustment",
        );
      }

      // Atomic operation: DB transaction + Redis pipeline
      const adjustment = await this.db.transaction(async (tx) => {
        // Create adjustment record
        const [adjustment] = await tx
          .insert(inventoryAdjustments)
          .values({
            variantId,
            oldQuantity: currentInventory,
            newQuantity,
            delta,
            type: dto.type,
            reason: dto.reason,
            note: dto.note || null,
            actorAdminId: adminId,
            metadata: null,
          })
          .returning();

        // Update Redis atomically using pipeline
        const pipeline = this.redisClient.pipeline();
        pipeline.set(
          KEY_PATTERNS.INVENTORY_VARIANT(variantId),
          newQuantity.toString(),
        );
        pipeline.publish(
          "inventory.updated",
          JSON.stringify({ variantId, newQuantity }),
        );
        await pipeline.exec();

        // Update DB variant inventory (for consistency)
        await tx
          .update(productVariants)
          .set({
            inventory: newQuantity,
            updatedAt: new Date(),
          })
          .where(eq(productVariants.id, variantId));

        return adjustment;
      });

      // Check if inventory is now low stock and create notification
      try {
        const threshold = await this.getLowStockThreshold(variantId);
        const committed =
          await this.inventoryStore.getReservedInventory(variantId);
        const available = Math.max(0, newQuantity - (committed || 0));

        if (available <= threshold && available > 0) {
          // Get variant info for notification
          let variant:
            | {
                sku: string | null;
                productId: string;
              }
            | undefined;
          try {
            const variantResult = await this.db
              .select({
                sku: productVariants.sku,
                productId: productVariants.productId,
              })
              .from(productVariants)
              .where(eq(productVariants.id, variantId))
              .limit(1);
            variant = variantResult[0];
          } catch (error) {
            this.logger.warn(
              createErrorContext(
                this.contextService,
                "AdminInventoryService.adjustInventory.selectVariant",
                error,
                { variantId },
              ),
              "Failed to fetch variant for notification",
            );
            variant = undefined;
          }

          if (variant) {
            let product: { title: string } | undefined;
            try {
              const productResult = await this.db
                .select({ title: products.title })
                .from(products)
                .where(eq(products.id, variant.productId))
                .limit(1);
              product = productResult[0];
            } catch (error) {
              this.logger.warn(
                createErrorContext(
                  this.contextService,
                  "AdminInventoryService.adjustInventory.selectProduct",
                  error,
                  { productId: variant.productId },
                ),
                "Failed to fetch product for notification",
              );
              product = undefined;
            }

            await this.notificationsService.createFromEvent({
              adminId: null, // Broadcast to all admins
              type: NotificationType.INVENTORY,
              title: "Low Stock Alert",
              message: `${product?.title || "Product"} (${variant.sku}) is low on stock. Available: ${available}`,
              meta: {
                variantId,
                productId: variant.productId,
                sku: variant.sku,
                available,
                threshold,
              },
            });
          }
        }
      } catch (error) {
        // Log but don't throw - notification failure shouldn't break inventory adjustment
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "createLowStockNotification",
            error,
            {
              variantId,
              newQuantity,
            },
          ),
          "Failed to create low stock notification",
        );
      }

      // Invalidate logs cache for this variant
      await this.invalidateLogsCache(variantId);

      return {
        id: adjustment.id,
        variantId: adjustment.variantId,
        oldQuantity: adjustment.oldQuantity,
        newQuantity: adjustment.newQuantity,
        delta: adjustment.delta,
        type: adjustment.type as InventoryAdjustmentType,
        reason: adjustment.reason as InventoryAdjustmentReason,
        note: adjustment.note || undefined,
        actorAdminId: adjustment.actorAdminId,
        createdAt: adjustment.createdAt,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        createErrorContext(this.contextService, "adjustInventory", error, {
          variantId,
          adminId,
        }),
        "Failed to adjust inventory",
      );
      throw error;
    }
  }

  /**
   * Bulk adjust inventory for multiple variants
   */
  async bulkAdjust(
    dto: BulkAdjustInventoryDto,
    adminId: string,
  ): Promise<BulkAdjustInventoryResponseDto> {
    const results: BulkAdjustmentResultDto[] = [];
    let successful = 0;
    let failed = 0;

    // Process each adjustment
    for (const adjustment of dto.adjustments) {
      try {
        // Find variant by SKU
        const [variant] = await this.db
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(eq(productVariants.sku, adjustment.sku))
          .limit(1);

        if (!variant) {
          results.push({
            sku: adjustment.sku,
            success: false,
            error: "Variant not found",
          });
          failed++;
          continue;
        }

        // Perform adjustment
        const adjustmentResult = await this.adjustInventory(
          variant.id,
          {
            type: adjustment.type,
            quantity: adjustment.quantity,
            reason: adjustment.reason,
            note: adjustment.note,
          },
          adminId,
        );

        results.push({
          sku: adjustment.sku,
          success: true,
          adjustmentId: adjustmentResult.id,
        });
        successful++;
      } catch (error) {
        results.push({
          sku: adjustment.sku,
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
        failed++;
      }
    }

    return {
      results,
      total: dto.adjustments.length,
      successful,
      failed,
    };
  }

  /**
   * Get inventory logs for a variant
   */
  async getInventoryLogs(
    variantId: string,
    query: InventoryLogsQueryDto,
  ): Promise<PaginatedInventoryLogsResponseDto> {
    try {
      const { page, limit, offset } = normalizePaginationParams(
        query.page,
        query.limit,
      );

      // Check cache first
      const cacheKey = `inv:logs:${variantId}:${JSON.stringify(query)}`;
      const cached = await this.redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build where conditions
      const conditions: ReturnType<typeof eq | typeof and>[] = [
        eq(inventoryAdjustments.variantId, variantId),
      ];

      if (query.startDate) {
        conditions.push(
          gte(inventoryAdjustments.createdAt, new Date(query.startDate)),
        );
      }
      if (query.endDate) {
        conditions.push(
          lte(inventoryAdjustments.createdAt, new Date(query.endDate)),
        );
      }
      if (query.actor) {
        conditions.push(eq(inventoryAdjustments.actorAdminId, query.actor));
      }
      if (query.reason) {
        conditions.push(eq(inventoryAdjustments.reason, query.reason));
      }
      if (query.type) {
        conditions.push(eq(inventoryAdjustments.type, query.type));
      }

      // Get total count
      const countQuery = this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(inventoryAdjustments)
        .where(and(...conditions));

      // Apply metadata filters if needed
      if (query.orderId || query.refundId) {
        // This requires checking metadata JSONB field
        // For now, we'll filter after fetching
      }

      const [{ count }] = await countQuery;

      // Get paginated logs
      const logs = await this.db
        .select()
        .from(inventoryAdjustments)
        .where(and(...conditions))
        .orderBy(desc(inventoryAdjustments.createdAt))
        .limit(limit)
        .offset(offset);

      // Filter by metadata if needed
      let filteredLogs = logs;
      if (query.orderId) {
        filteredLogs = filteredLogs.filter(
          (log) => log.metadata?.orderId === query.orderId,
        );
      }
      if (query.refundId) {
        filteredLogs = filteredLogs.filter(
          (log) => log.metadata?.refundId === query.refundId,
        );
      }

      const logEntries: InventoryLogEntryDto[] = filteredLogs.map((log) => ({
        id: log.id,
        variantId: log.variantId,
        delta: log.delta,
        oldInventory: log.oldQuantity,
        newInventory: log.newQuantity,
        type: log.type as InventoryAdjustmentType,
        reason: log.reason as InventoryAdjustmentReason,
        actorAdminId: log.actorAdminId,
        metadata: log.metadata || undefined,
        createdAt: log.createdAt,
      }));

      const response: PaginatedInventoryLogsResponseDto = {
        data: logEntries,
        pagination: generatePaginationMetadata(page, limit, count),
      };

      // Cache response
      await this.redisClient.setex(
        cacheKey,
        this.LOGS_CACHE_TTL,
        JSON.stringify(response),
      );

      return response;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getInventoryLogs", error, {
          variantId,
        }),
        "Failed to get inventory logs",
      );
      throw error;
    }
  }

  /**
   * Get real-time reservations for a variant
   */
  async getVariantReservations(
    variantId: string,
  ): Promise<InventoryReservationsResponseDto> {
    try {
      // Get reserved count from Redis
      const reserved =
        await this.inventoryStore.getReservedInventory(variantId);

      // Scan for individual reservations
      const reservationPattern = `inventory:reservation:*:${variantId}`;
      const keys: string[] = [];
      let cursor = "0";

      do {
        const [nextCursor, foundKeys] = await this.redisClient.scan(
          cursor,
          "MATCH",
          reservationPattern,
          "COUNT",
          100,
        );
        cursor = nextCursor;
        keys.push(...foundKeys);
      } while (cursor !== "0");

      // Get reservation details
      const activeReservations = await Promise.all(
        keys.map(async (key) => {
          const qty = parseInt((await this.redisClient.get(key)) || "0", 10);
          const ttl = await this.redisClient.ttl(key);
          const cartId = key.split(":")[2]; // Extract cartId from key pattern
          const expiresAt = new Date(Date.now() + ttl * 1000);

          return {
            cartId,
            qty,
            expiresAt,
          };
        }),
      );

      // Filter expired reservations
      const now = new Date();
      const expired = activeReservations.filter(
        (r) => r.expiresAt < now,
      ).length;
      const active = activeReservations.filter((r) => r.expiresAt >= now);

      return {
        variantId,
        reserved: reserved || 0,
        expired,
        activeReservations: active,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "getVariantReservations",
          error,
          {
            variantId,
          },
        ),
        "Failed to get variant reservations",
      );
      throw error;
    }
  }

  /**
   * Get system-wide reservations summary
   */
  async getReservationsSummary(): Promise<ReservationsSummaryResponseDto> {
    try {
      // Scan for all reserved keys
      const reservedPattern = "inventory:reserved:*";
      const keys: string[] = [];
      let cursor = "0";

      do {
        const [nextCursor, foundKeys] = await this.redisClient.scan(
          cursor,
          "MATCH",
          reservedPattern,
          "COUNT",
          100,
        );
        cursor = nextCursor;
        keys.push(...foundKeys);
      } while (cursor !== "0");

      // Get reserved counts
      const variants = await Promise.all(
        keys.map(async (key) => {
          const variantId = key.split(":")[2]; // Extract variantId
          const committed = parseInt(
            (await this.redisClient.get(key)) || "0",
            10,
          );
          return {
            variantId,
            committed,
          };
        }),
      );

      const totalCommitted = variants.reduce((sum, v) => sum + v.committed, 0);

      return {
        totalCommitted,
        variantCount: variants.length,
        variants: variants.filter((v) => v.committed > 0),
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "getReservationsSummary",
          error,
        ),
        "Failed to get reservations summary",
      );
      throw error;
    }
  }

  /**
   * Get inventory health dashboard metrics
   */
  async getInventoryHealth(): Promise<InventoryHealthResponseDto> {
    try {
      // Scan all inventory variant keys
      const inventoryPattern = "inventory:variant:*";
      const keys: string[] = [];
      let cursor = "0";

      do {
        const [nextCursor, foundKeys] = await this.redisClient.scan(
          cursor,
          "MATCH",
          inventoryPattern,
          "COUNT",
          100,
        );
        cursor = nextCursor;
        keys.push(...foundKeys);
      } while (cursor !== "0");

      // Get inventory counts
      let totalStock = 0;
      let committedStock = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      for (const key of keys) {
        const variantId = key.split(":")[2];
        const inventory = parseInt(
          (await this.redisClient.get(key)) || "0",
          10,
        );
        const committed =
          (await this.inventoryStore.getReservedInventory(variantId)) || 0;
        const available = Math.max(0, inventory - committed);
        const threshold = await this.getLowStockThreshold(variantId);

        totalStock += inventory;
        committedStock += committed;

        if (available <= threshold && available > 0) {
          lowStockCount++;
        }
        if (available === 0) {
          outOfStockCount++;
        }
      }

      const availableStock = totalStock - committedStock;

      // Get fastest/slowest moving SKUs from order_items
      const fastestMoving = await this.db
        .select({
          sku: productVariants.sku,
          variantId: productVariants.id,
          productTitle: products.title,
          quantity: sql<number>`sum(${orderItems.quantity})::int`,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .innerJoin(
          orderItems,
          eq(orderItems.productVariantId, productVariants.id),
        )
        .groupBy(productVariants.id, products.title)
        .orderBy(desc(sql`sum(${orderItems.quantity})`))
        .limit(10);

      const slowestMoving = await this.db
        .select({
          sku: productVariants.sku,
          variantId: productVariants.id,
          productTitle: products.title,
          quantity: sql<number>`sum(${orderItems.quantity})::int`,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .innerJoin(
          orderItems,
          eq(orderItems.productVariantId, productVariants.id),
        )
        .groupBy(productVariants.id, products.title)
        .orderBy(asc(sql`sum(${orderItems.quantity})`))
        .limit(10);

      return {
        totalStock,
        availableStock,
        committedStock,
        lowStockCount,
        outOfStockCount,
        fastestMovingSkus: fastestMoving.map((item) => ({
          sku: item.sku,
          variantId: item.variantId,
          productTitle: item.productTitle,
          quantity: item.quantity,
        })),
        slowestMovingSkus: slowestMoving.map((item) => ({
          sku: item.sku,
          variantId: item.variantId,
          productTitle: item.productTitle,
          quantity: item.quantity,
        })),
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getInventoryHealth", error),
        "Failed to get inventory health",
      );
      throw error;
    }
  }

  /**
   * Get inventory settings
   */
  async getInventorySettings(): Promise<InventorySettingsResponseDto> {
    try {
      // Check cache first
      const cacheKey = "inv:settings";
      const cached = await this.redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from DB (singleton - should only be one row)
      const [settings] = await this.db
        .select()
        .from(inventorySettings)
        .limit(1);

      if (!settings) {
        // Create default settings if none exist
        const [newSettings] = await this.db
          .insert(inventorySettings)
          .values({
            globalLowStockThreshold: 5,
            perVariantOverrides: null,
          })
          .returning();

        const response: InventorySettingsResponseDto = {
          id: newSettings.id,
          globalLowStockThreshold: newSettings.globalLowStockThreshold,
          perVariantOverrides: newSettings.perVariantOverrides || undefined,
          updatedAt: newSettings.updatedAt,
          updatedBy: newSettings.updatedBy || undefined,
        };

        await this.redisClient.setex(
          cacheKey,
          this.SETTINGS_CACHE_TTL,
          JSON.stringify(response),
        );

        return response;
      }

      const response: InventorySettingsResponseDto = {
        id: settings.id,
        globalLowStockThreshold: settings.globalLowStockThreshold,
        perVariantOverrides: settings.perVariantOverrides || undefined,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy || undefined,
      };

      // Cache response
      await this.redisClient.setex(
        cacheKey,
        this.SETTINGS_CACHE_TTL,
        JSON.stringify(response),
      );

      return response;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getInventorySettings", error),
        "Failed to get inventory settings",
      );
      throw error;
    }
  }

  /**
   * Update inventory settings
   */
  async updateInventorySettings(
    dto: UpdateInventorySettingsDto,
    adminId: string,
  ): Promise<InventorySettingsResponseDto> {
    try {
      // Check if settings exist (singleton pattern)
      const [existing] = await this.db
        .select()
        .from(inventorySettings)
        .limit(1);

      let settings: typeof inventorySettings.$inferSelect;
      if (existing) {
        // Update existing
        [settings] = await this.db
          .update(inventorySettings)
          .set({
            globalLowStockThreshold: dto.globalLowStockThreshold,
            perVariantOverrides: dto.perVariantOverrides || null,
            updatedBy: adminId,
            updatedAt: new Date(),
          })
          .where(eq(inventorySettings.id, existing.id))
          .returning();
      } else {
        // Insert new
        [settings] = await this.db
          .insert(inventorySettings)
          .values({
            globalLowStockThreshold: dto.globalLowStockThreshold,
            perVariantOverrides: dto.perVariantOverrides || null,
            updatedBy: adminId,
          })
          .returning();
      }

      const response: InventorySettingsResponseDto = {
        id: settings.id,
        globalLowStockThreshold: settings.globalLowStockThreshold,
        perVariantOverrides: settings.perVariantOverrides || undefined,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy || undefined,
      };

      // Update cache (invalidate first to ensure fresh data)
      await this.invalidateSettingsCache();
      await this.redisClient.setex(
        "inv:settings",
        this.SETTINGS_CACHE_TTL,
        JSON.stringify(response),
      );

      return response;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "updateInventorySettings",
          error,
          {
            adminId,
          },
        ),
        "Failed to update inventory settings",
      );
      throw error;
    }
  }

  /**
   * Get variants index (quick SKU map)
   */
  async getVariantsIndex(): Promise<VariantsIndexResponseDto> {
    try {
      const variants = await this.db
        .select({
          variantId: productVariants.id,
          sku: productVariants.sku,
          productTitle: products.title,
          size: productVariants.size,
          color: productVariants.color,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .orderBy(asc(productVariants.sku));

      return {
        variants: variants.map((v) => ({
          variantId: v.variantId,
          sku: v.sku,
          productTitle: v.productTitle,
          attributes: {
            ...(v.size && { size: v.size }),
            ...(v.color && { color: v.color }),
          },
        })),
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getVariantsIndex", error),
        "Failed to get variants index",
      );
      throw error;
    }
  }

  /**
   * Helper: Get low stock threshold for a variant
   */
  private async getLowStockThreshold(variantId: string): Promise<number> {
    const settings = await this.getInventorySettings();
    return (
      settings.perVariantOverrides?.[variantId] ??
      settings.globalLowStockThreshold
    );
  }

  /**
   * Helper: Invalidate logs cache for a variant
   */
  private async invalidateLogsCache(variantId: string): Promise<void> {
    try {
      // Scan for all log cache keys for this variant
      const pattern = `inv:logs:${variantId}:*`;
      let cursor = "0";
      const keysToDelete: string[] = [];

      do {
        const [nextCursor, keys] = await this.redisClient.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = nextCursor;
        keysToDelete.push(...keys);
      } while (cursor !== "0");

      if (keysToDelete.length > 0) {
        await this.redisClient.del(...keysToDelete);
        this.logger.debug(
          `Invalidated ${keysToDelete.length} log cache keys for variant ${variantId}`,
        );
      }
    } catch (error) {
      // Don't throw - cache invalidation failure shouldn't break the operation
      this.logger.warn(
        `Failed to invalidate logs cache for variant ${variantId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Helper: Invalidate settings cache
   */
  private async invalidateSettingsCache(): Promise<void> {
    try {
      await this.redisClient.del("inv:settings");
      this.logger.debug("Invalidated settings cache");
    } catch (error) {
      // Don't throw - cache invalidation failure shouldn't break the operation
      this.logger.warn(
        `Failed to invalidate settings cache: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
