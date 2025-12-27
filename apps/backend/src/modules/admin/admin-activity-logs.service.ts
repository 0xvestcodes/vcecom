import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  adminActivityLogs,
  and,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
  users,
} from "@vcecom/db";
import {
  generatePaginationMetadata,
  normalizePaginationParams,
} from "../../common/utils/pagination.utils";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import {
  ActivityLogResponseDto,
  AdminQueryActivityLogsDto,
  PaginatedActivityLogsResponseDto,
} from "./dto/admin-activity-logs.dto";

@Injectable()
export class AdminActivityLogsService {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}
  /**
   * Extract resource type from action string
   * Examples:
   * - "product.create" → "product"
   * - "order.update" → "order"
   * - "admin.login" → "auth"
   * - "discount.delete" → "discount"
   */
  private extractResource(action: string): string | null {
    if (!action) return null;

    // Handle admin.* actions as "auth"
    if (action.startsWith("admin.")) {
      return "auth";
    }

    // Extract resource from pattern: {resource}.{action}
    const parts = action.split(".");
    if (parts.length >= 2) {
      return parts[0];
    }

    return null;
  }

  /**
   * Get all activity logs with filters and pagination
   */
  async getActivityLogs(
    query: AdminQueryActivityLogsDto,
  ): Promise<PaginatedActivityLogsResponseDto> {
    const { page, limit, offset } = normalizePaginationParams(
      query.page,
      query.limit,
    );

    // Build where conditions
    const conditions: ReturnType<typeof and | typeof or>[] = [];

    // Admin ID filter
    if (query.adminId) {
      conditions.push(eq(adminActivityLogs.adminId, query.adminId));
    }

    // Action filter (exact match or pattern)
    if (query.action) {
      conditions.push(eq(adminActivityLogs.action, query.action));
    }

    // Resource filter (extract from action using LIKE)
    if (query.resource) {
      if (query.resource === "auth") {
        // Match admin.* actions
        conditions.push(sql`${adminActivityLogs.action} LIKE 'admin.%'`);
      } else {
        // Match {resource}.% pattern
        const pattern = `${query.resource}.%`;
        conditions.push(sql`${adminActivityLogs.action} LIKE ${pattern}`);
      }
    }

    // Date range filters
    if (query.startDate) {
      conditions.push(
        gte(adminActivityLogs.createdAt, new Date(query.startDate)),
      );
    }
    if (query.endDate) {
      conditions.push(
        lte(adminActivityLogs.createdAt, new Date(query.endDate)),
      );
    }

    // Search filter (searches in admin email, action, entityId)
    if (query.search) {
      const searchPattern = `%${query.search}%`;
      const searchCondition = or(
        ilike(users.email, searchPattern),
        ilike(adminActivityLogs.action, searchPattern),
        ilike(adminActivityLogs.entityId, searchPattern),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Build final where condition
    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countQuery = whereCondition
      ? this.db
          .select({ count: sql<number>`count(*)` })
          .from(adminActivityLogs)
          .leftJoin(users, eq(adminActivityLogs.adminId, users.id))
          .where(whereCondition)
      : this.db
          .select({ count: sql<number>`count(*)` })
          .from(adminActivityLogs)
          .leftJoin(users, eq(adminActivityLogs.adminId, users.id));

    const totalResult = await countQuery;
    const total = Number(totalResult[0]?.count || 0);

    if (total === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Get activity logs with admin info
    const logsQuery = this.db
      .select({
        id: adminActivityLogs.id,
        adminId: adminActivityLogs.adminId,
        adminEmail: users.email,
        action: adminActivityLogs.action,
        entityId: adminActivityLogs.entityId,
        metadata: adminActivityLogs.metadata,
        diff: adminActivityLogs.diff,
        ipAddress: adminActivityLogs.ipAddress,
        userAgent: adminActivityLogs.userAgent,
        createdAt: adminActivityLogs.createdAt,
      })
      .from(adminActivityLogs)
      .leftJoin(users, eq(adminActivityLogs.adminId, users.id))
      .where(whereCondition)
      .orderBy(desc(adminActivityLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const logs = await logsQuery;

    // Map to response DTOs with resource extraction
    const data: ActivityLogResponseDto[] = logs.map((log) => ({
      id: log.id,
      adminId: log.adminId,
      adminEmail: log.adminEmail,
      action: log.action,
      resource: this.extractResource(log.action),
      entityId: log.entityId,
      metadata: log.metadata as Record<string, unknown> | null,
      diff: log.diff
        ? (log.diff as {
            before: Record<string, unknown> | null;
            after: Record<string, unknown> | null;
          })
        : null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    }));

    const pagination = generatePaginationMetadata(total, page, limit);

    return {
      data,
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.totalPages,
    };
  }

  /**
   * Get a single activity log by ID
   */
  async getActivityLog(id: string): Promise<ActivityLogResponseDto> {
    const [log] = await this.db
      .select({
        id: adminActivityLogs.id,
        adminId: adminActivityLogs.adminId,
        adminEmail: users.email,
        action: adminActivityLogs.action,
        entityId: adminActivityLogs.entityId,
        metadata: adminActivityLogs.metadata,
        diff: adminActivityLogs.diff,
        ipAddress: adminActivityLogs.ipAddress,
        userAgent: adminActivityLogs.userAgent,
        createdAt: adminActivityLogs.createdAt,
      })
      .from(adminActivityLogs)
      .leftJoin(users, eq(adminActivityLogs.adminId, users.id))
      .where(eq(adminActivityLogs.id, id))
      .limit(1);

    if (!log) {
      throw new NotFoundException(`Activity log with ID ${id} not found`);
    }

    return {
      id: log.id,
      adminId: log.adminId,
      adminEmail: log.adminEmail,
      action: log.action,
      resource: this.extractResource(log.action),
      entityId: log.entityId,
      metadata: log.metadata as Record<string, unknown> | null,
      diff: log.diff
        ? (log.diff as {
            before: Record<string, unknown> | null;
            after: Record<string, unknown> | null;
          })
        : null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    };
  }

  /**
   * Get diff for a specific activity log
   */
  async getActivityLogDiff(id: string): Promise<{
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  }> {
    const [log] = await this.db
      .select({
        diff: adminActivityLogs.diff,
      })
      .from(adminActivityLogs)
      .where(eq(adminActivityLogs.id, id))
      .limit(1);

    if (!log) {
      throw new NotFoundException(`Activity log with ID ${id} not found`);
    }

    if (!log.diff) {
      throw new NotFoundException(
        `No diff available for activity log with ID ${id}`,
      );
    }

    return log.diff as {
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
    };
  }
}
