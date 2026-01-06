import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { incomingWebhooks, webhookDeliveryLogs, webhooks } from "@vcecom/db";
import { and, desc, eq, SQL, sql } from "drizzle-orm";
import { PinoLogger } from "nestjs-pino";
import { DEFAULT_PAGE_SIZE } from "../../../common/constants";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import type { Database } from "../../../modules/database/db";
import { DB_TOKEN } from "../../database/database.module";
import { CreateWebhookDto } from "../dto/create-webhook.dto";
import { QueryIncomingWebhooksDto } from "../dto/query-incoming-webhooks.dto";
import { QueryWebhookLogsDto } from "../dto/query-webhook-logs.dto";
import { QueryWebhooksDto } from "../dto/query-webhooks.dto";
import { UpdateWebhookDto } from "../dto/update-webhook.dto";
import { WebhookDeliveryQueue } from "../queues/webhook-delivery.queue";

@Injectable()
export class AdminWebhooksService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly webhookQueue: WebhookDeliveryQueue,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * List webhooks with pagination and filters
   */
  async listWebhooks(query: QueryWebhooksDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [];

    if (query.storeId) {
      conditions.push(eq(webhooks.storeId, query.storeId));
    }

    if (query.isActive !== undefined) {
      conditions.push(eq(webhooks.isActive, query.isActive));
    }

    if (query.eventType) {
      conditions.push(
        sql`${webhooks.events} @> ${sql.raw(`'["${query.eventType}"]'`)}::jsonb`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalCount] = await Promise.all([
      this.db
        .select()
        .from(webhooks)
        .where(whereClause)
        .orderBy(desc(webhooks.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(webhooks)
        .where(whereClause),
    ]);

    return {
      items: items.map(this.mapToResponseDto),
      pagination: {
        page,
        pageSize,
        total: Number(totalCount[0]?.count || 0),
        totalPages: Math.ceil(Number(totalCount[0]?.count || 0) / pageSize),
      },
    };
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(id: string) {
    const [webhook] = await this.db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);

    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }

    return this.mapToResponseDto(webhook);
  }

  /**
   * Create webhook
   */
  async createWebhook(dto: CreateWebhookDto, storeId: string) {
    const [webhook] = await this.db
      .insert(webhooks)
      .values({
        storeId,
        name: dto.name,
        url: dto.url,
        events: dto.events,
        secret: dto.secret,
        isActive: dto.isActive ?? true,
        timeoutMs: dto.timeoutMs ?? 30000,
        retryConfig: dto.retryConfig ?? {
          maxAttempts: 5,
          backoffMs: [1000, 5000, 30000, 300000, 1800000],
        },
        headers: dto.headers || null,
      })
      .returning();

    this.logger.info(
      createLogContext(this.contextService, "createWebhook", {
        webhookId: webhook.id,
        name: webhook.name,
      }),
      "Webhook created",
    );

    return this.mapToResponseDto(webhook);
  }

  /**
   * Update webhook
   */
  async updateWebhook(id: string, dto: UpdateWebhookDto) {
    const updateData: Partial<typeof webhooks.$inferInsert> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.url !== undefined) updateData.url = dto.url;
    if (dto.events !== undefined) updateData.events = dto.events;
    if (dto.secret !== undefined) updateData.secret = dto.secret;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.timeoutMs !== undefined) updateData.timeoutMs = dto.timeoutMs;
    if (dto.retryConfig !== undefined) updateData.retryConfig = dto.retryConfig;
    if (dto.headers !== undefined) updateData.headers = dto.headers;

    const [webhook] = await this.db
      .update(webhooks)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(webhooks.id, id))
      .returning();

    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }

    this.logger.info(
      createLogContext(this.contextService, "updateWebhook", {
        webhookId: webhook.id,
      }),
      "Webhook updated",
    );

    return this.mapToResponseDto(webhook);
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(id: string) {
    const [webhook] = await this.db
      .delete(webhooks)
      .where(eq(webhooks.id, id))
      .returning();

    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }

    this.logger.info(
      createLogContext(this.contextService, "deleteWebhook", {
        webhookId: id,
      }),
      "Webhook deleted",
    );
  }

  /**
   * Enable webhook
   */
  async enableWebhook(id: string) {
    const [webhook] = await this.db
      .update(webhooks)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(webhooks.id, id))
      .returning();

    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }

    return this.mapToResponseDto(webhook);
  }

  /**
   * Disable webhook
   */
  async disableWebhook(id: string) {
    const [webhook] = await this.db
      .update(webhooks)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(webhooks.id, id))
      .returning();

    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }

    return this.mapToResponseDto(webhook);
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(
    id: string,
    testPayload?: Record<string, unknown>,
    testEventType?: string,
  ) {
    const [webhook] = await this.db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);

    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }

    const payload = testPayload || {
      test: true,
      message: "Test webhook",
      timestamp: new Date().toISOString(),
    };

    const eventType = testEventType || "test.webhook";

    try {
      await this.webhookQueue.addJob({
        webhookId: webhook.id,
        eventType,
        eventId: `test-${crypto.randomUUID()}`,
        payload,
        url: webhook.url,
        secret: webhook.secret,
        headers: webhook.headers || {},
        timeoutMs: webhook.timeoutMs,
      });

      return { success: true, message: "Test webhook queued for delivery" };
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "testWebhook", error, {
          webhookId: id,
        }),
        "Failed to queue test webhook",
      );
      throw error;
    }
  }

  /**
   * Get webhook delivery logs
   */
  async getWebhookLogs(webhookId: string, query: QueryWebhookLogsDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(webhookDeliveryLogs.webhookId, webhookId)];

    if (query.status) {
      conditions.push(eq(webhookDeliveryLogs.status, query.status));
    }

    if (query.eventType) {
      conditions.push(eq(webhookDeliveryLogs.eventType, query.eventType));
    }

    if (query.eventId) {
      conditions.push(eq(webhookDeliveryLogs.eventId, query.eventId));
    }

    const whereClause = and(...conditions);

    const [items, totalCount] = await Promise.all([
      this.db
        .select()
        .from(webhookDeliveryLogs)
        .where(whereClause)
        .orderBy(desc(webhookDeliveryLogs.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(webhookDeliveryLogs)
        .where(whereClause),
    ]);

    return {
      items: items.map(this.mapLogToResponseDto),
      pagination: {
        page,
        pageSize,
        total: Number(totalCount[0]?.count || 0),
        totalPages: Math.ceil(Number(totalCount[0]?.count || 0) / pageSize),
      },
    };
  }

  /**
   * List incoming webhooks
   */
  async listIncomingWebhooks(query: QueryIncomingWebhooksDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [];

    if (query.storeId) {
      conditions.push(eq(incomingWebhooks.storeId, query.storeId));
    }

    if (query.provider) {
      conditions.push(eq(incomingWebhooks.provider, query.provider));
    }

    if (query.status) {
      conditions.push(eq(incomingWebhooks.status, query.status));
    }

    if (query.eventType) {
      conditions.push(eq(incomingWebhooks.eventType, query.eventType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalCount] = await Promise.all([
      this.db
        .select()
        .from(incomingWebhooks)
        .where(whereClause)
        .orderBy(desc(incomingWebhooks.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(incomingWebhooks)
        .where(whereClause),
    ]);

    return {
      items: items.map(this.mapIncomingWebhookToResponseDto),
      pagination: {
        page,
        pageSize,
        total: Number(totalCount[0]?.count || 0),
        totalPages: Math.ceil(Number(totalCount[0]?.count || 0) / pageSize),
      },
    };
  }

  /**
   * Map webhook to response DTO
   */
  private mapToResponseDto(webhook: typeof webhooks.$inferSelect) {
    return {
      id: webhook.id,
      storeId: webhook.storeId,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      timeoutMs: webhook.timeoutMs,
      retryConfig: webhook.retryConfig,
      headers: webhook.headers || undefined,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }

  /**
   * Map webhook log to response DTO
   */
  private mapLogToResponseDto(log: typeof webhookDeliveryLogs.$inferSelect) {
    return {
      id: log.id,
      webhookId: log.webhookId,
      eventType: log.eventType,
      eventId: log.eventId,
      status: log.status,
      attemptCount: log.attemptCount,
      responseStatus: log.responseStatus || undefined,
      responseBody: log.responseBody || undefined,
      requestBody: log.requestBody,
      errorMessage: log.errorMessage || undefined,
      deliveredAt: log.deliveredAt || undefined,
      createdAt: log.createdAt,
    };
  }

  /**
   * Map incoming webhook to response DTO
   */
  private mapIncomingWebhookToResponseDto(
    webhook: typeof incomingWebhooks.$inferSelect,
  ) {
    return {
      id: webhook.id,
      storeId: webhook.storeId,
      provider: webhook.provider,
      eventType: webhook.eventType,
      payload: webhook.payload,
      signature: webhook.signature || undefined,
      headers: webhook.headers || undefined,
      status: webhook.status,
      processedAt: webhook.processedAt || undefined,
      errorMessage: webhook.errorMessage || undefined,
      createdAt: webhook.createdAt,
    };
  }
}
