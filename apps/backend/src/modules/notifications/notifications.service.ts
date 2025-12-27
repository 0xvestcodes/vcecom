import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull, notifications, or, sql } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createErrorContext } from "../../common/logging/logging.helper";
import {
  generatePaginationMetadata,
  normalizePaginationParams,
} from "../../common/utils/pagination.utils";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import {
  CreateNotificationDto,
  NotificationResponseDto,
  PaginatedNotificationsResponseDto,
  QueryNotificationsDto,
} from "./dto/notifications.dto";
import {
  NotificationEventPayload,
  NotificationType,
} from "./types/notification.types";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Create a new notification
   */
  async create(dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    try {
      const [notification] = await this.db
        .insert(notifications)
        .values({
          adminId: dto.adminId || null,
          type: dto.type,
          title: dto.title,
          message: dto.message,
          meta: dto.meta ? (dto.meta as Record<string, unknown>) : null,
          read: false,
        })
        .returning();

      return this.mapToResponseDto(notification);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "createNotification", error, {
          dto,
        }),
        "Failed to create notification",
      );
      throw error;
    }
  }

  /**
   * Create notification from event payload
   */
  async createFromEvent(
    payload: NotificationEventPayload,
  ): Promise<NotificationResponseDto> {
    return this.create({
      adminId: payload.adminId || null,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      meta: payload.meta,
    });
  }

  /**
   * Get all notifications with pagination and filters
   */
  async findAll(
    adminId: string,
    query: QueryNotificationsDto,
  ): Promise<PaginatedNotificationsResponseDto> {
    const { page, limit, offset } = normalizePaginationParams(
      query.page,
      query.limit,
    );

    // Build where conditions
    const conditions = [
      // Show broadcast notifications (adminId is null) or notifications for this admin
      or(isNull(notifications.adminId), eq(notifications.adminId, adminId)),
    ];

    if (query.type) {
      conditions.push(eq(notifications.type, query.type));
    }

    if (query.read !== undefined) {
      conditions.push(eq(notifications.read, query.read));
    }

    const whereCondition = and(...conditions);

    // Get total count
    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(whereCondition);

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

    // Get notifications
    const notificationsQuery = this.db
      .select()
      .from(notifications)
      .where(whereCondition)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const results = await notificationsQuery;

    const data: NotificationResponseDto[] = results.map((n) =>
      this.mapToResponseDto(n),
    );

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
   * Mark a notification as read
   */
  async markRead(adminId: string, notificationId: string): Promise<void> {
    // Verify notification exists and belongs to admin or is broadcast
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          or(isNull(notifications.adminId), eq(notifications.adminId, adminId)),
        ),
      )
      .limit(1);

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }

    await this.db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, notificationId));
  }

  /**
   * Mark all notifications as read for an admin
   */
  async markAllRead(adminId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          or(isNull(notifications.adminId), eq(notifications.adminId, adminId)),
          eq(notifications.read, false),
        ),
      );
  }

  /**
   * Delete a notification
   */
  async delete(adminId: string, notificationId: string): Promise<void> {
    // Verify notification exists and belongs to admin or is broadcast
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          or(isNull(notifications.adminId), eq(notifications.adminId, adminId)),
        ),
      )
      .limit(1);

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }

    await this.db
      .delete(notifications)
      .where(eq(notifications.id, notificationId));
  }

  /**
   * Map database notification to response DTO
   */
  private mapToResponseDto(
    notification: typeof notifications.$inferSelect,
  ): NotificationResponseDto {
    return {
      id: notification.id,
      adminId: notification.adminId || undefined,
      type: notification.type as NotificationType,
      title: notification.title,
      message: notification.message,
      meta: notification.meta as Record<string, unknown> | null | undefined,
      read: notification.read,
      createdAt: notification.createdAt,
    };
  }
}
