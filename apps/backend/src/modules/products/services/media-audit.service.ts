import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  desc,
  eq,
  mediaAuditActionEnum,
  mediaAuditLogs,
  sql,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";

export interface AuditLogFilters {
  productId?: string;
  variantId?: string;
  imageId?: string;
  action?: string;
  performedBy?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogStats {
  totalLogs: number;
  byAction: Record<string, number>;
  byPerformedBy: Record<string, number>;
  recentActions: Array<{
    action: string;
    count: number;
    lastPerformed: Date;
  }>;
}

@Injectable()
export class MediaAuditService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Log a media consistency action
   */
  async logAction(
    action: string,
    performedBy: string,
    options?: {
      productId?: string;
      variantId?: string;
      imageId?: string;
      details?: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      await this.db.insert(mediaAuditLogs).values({
        action: action as (typeof mediaAuditActionEnum.enumValues)[number],
        performedBy,
        productId: options?.productId || null,
        variantId: options?.variantId || null,
        imageId: options?.imageId || null,
        details: options?.details || null,
      });

      this.logger.debug(
        createLogContext(this.contextService, "logAction", {
          action,
          performedBy,
          productId: options?.productId,
          variantId: options?.variantId,
          imageId: options?.imageId,
        }),
        "Media audit log entry created",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "logAction", error, {
          action,
          performedBy,
        }),
        "Failed to create media audit log entry",
      );
      // Don't throw - audit logging failures shouldn't break operations
    }
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(filters: AuditLogFilters = {}) {
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle ORM condition array type
    const conditions: any[] = [];

    if (filters.productId) {
      conditions.push(eq(mediaAuditLogs.productId, filters.productId));
    }

    if (filters.variantId) {
      conditions.push(eq(mediaAuditLogs.variantId, filters.variantId));
    }

    if (filters.imageId) {
      conditions.push(eq(mediaAuditLogs.imageId, filters.imageId));
    }

    if (filters.action) {
      conditions.push(
        eq(
          mediaAuditLogs.action,
          filters.action as (typeof mediaAuditActionEnum.enumValues)[number],
        ),
      );
    }

    if (filters.performedBy) {
      conditions.push(eq(mediaAuditLogs.performedBy, filters.performedBy));
    }

    if (filters.startDate) {
      conditions.push(sql`${mediaAuditLogs.createdAt} >= ${filters.startDate}`);
    }

    if (filters.endDate) {
      conditions.push(sql`${mediaAuditLogs.createdAt} <= ${filters.endDate}`);
    }

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    const baseQuery = this.db
      .select()
      .from(mediaAuditLogs)
      .where(whereCondition)
      .orderBy(desc(mediaAuditLogs.createdAt));

    if (filters.limit && filters.offset) {
      return baseQuery.limit(filters.limit).offset(filters.offset);
    }
    if (filters.limit) {
      return baseQuery.limit(filters.limit);
    }
    if (filters.offset) {
      return baseQuery.offset(filters.offset);
    }

    return baseQuery;
  }

  /**
   * Get audit log statistics
   */
  async getAuditStats(): Promise<AuditLogStats> {
    const allLogs = await this.db.select().from(mediaAuditLogs);

    const byAction: Record<string, number> = {};
    const byPerformedBy: Record<string, number> = {};
    const actionLastPerformed: Record<string, Date> = {};

    for (const log of allLogs) {
      // Count by action
      byAction[log.action] = (byAction[log.action] || 0) + 1;

      // Count by performedBy
      byPerformedBy[log.performedBy] =
        (byPerformedBy[log.performedBy] || 0) + 1;

      // Track last performed date
      if (
        !actionLastPerformed[log.action] ||
        log.createdAt > actionLastPerformed[log.action]
      ) {
        actionLastPerformed[log.action] = log.createdAt;
      }
    }

    const recentActions = Object.entries(byAction).map(([action, count]) => ({
      action,
      count,
      lastPerformed: actionLastPerformed[action],
    }));

    return {
      totalLogs: allLogs.length,
      byAction,
      byPerformedBy,
      recentActions: recentActions.sort(
        (a, b) => b.lastPerformed.getTime() - a.lastPerformed.getTime(),
      ),
    };
  }
}
