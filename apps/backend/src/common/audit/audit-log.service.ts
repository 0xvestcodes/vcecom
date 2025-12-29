import { Inject, Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { ContextService } from "../logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../logging/logging.helper";

export interface AuditLogEntry {
  id?: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  actorType: "admin" | "customer" | "system";
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
}

/**
 * Service for audit logging of sensitive operations
 * Logs order creation, cancellation, refunds, status changes, etc.
 */
@Injectable()
export class AuditLogService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly _db: Database,
  ) {}

  /**
   * Log an audit event
   * In production, this would write to an audit_logs table
   * For now, we log to structured logs
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // In production, you would insert into audit_logs table:
      // await this.db.insert(auditLogs).values({
      //   entityType: entry.entityType,
      //   entityId: entry.entityId,
      //   action: entry.action,
      //   actorId: entry.actorId,
      //   actorType: entry.actorType,
      //   changes: entry.changes ? JSON.stringify(entry.changes) : null,
      //   metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      //   ipAddress: entry.ipAddress,
      //   userAgent: entry.userAgent,
      //   createdAt: new Date(),
      // });

      // For now, log to structured logs
      this.logger.info(
        createLogContext(this.contextService, "auditLog", {
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          actorId: entry.actorId,
          actorType: entry.actorType,
          changes: entry.changes,
          metadata: entry.metadata,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        }),
        `Audit log: ${entry.action} on ${entry.entityType} ${entry.entityId}`,
      );
    } catch (error) {
      // Don't fail operations if audit logging fails
      this.logger.error(
        createErrorContext(this.contextService, "auditLog", error, {
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
        }),
        "Failed to log audit event",
      );
    }
  }

  /**
   * Log order creation
   */
  async logOrderCreation(
    orderId: string,
    customerId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      entityType: "order",
      entityId: orderId,
      action: "CREATE",
      actorId: customerId,
      actorType: "customer",
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log order cancellation
   */
  async logOrderCancellation(
    orderId: string,
    actorId: string,
    actorType: "admin" | "customer",
    reason?: string,
  ): Promise<void> {
    await this.log({
      entityType: "order",
      entityId: orderId,
      action: "CANCEL",
      actorId,
      actorType,
      metadata: {
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log order status change
   */
  async logOrderStatusChange(
    orderId: string,
    oldStatus: string,
    newStatus: string,
    actorId: string,
    actorType: "admin" | "customer" | "system",
  ): Promise<void> {
    await this.log({
      entityType: "order",
      entityId: orderId,
      action: "STATUS_CHANGE",
      actorId,
      actorType,
      changes: {
        oldStatus,
        newStatus,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log refund creation
   */
  async logRefundCreation(
    refundId: string,
    orderId: string,
    amount: number,
    reason: string,
    actorId: string | null,
    actorType: "admin" | "customer" | "system",
  ): Promise<void> {
    await this.log({
      entityType: "refund",
      entityId: refundId,
      action: "CREATE",
      actorId,
      actorType,
      metadata: {
        orderId,
        amount,
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log payment retry
   */
  async logPaymentRetry(
    orderId: string,
    customerId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      entityType: "order",
      entityId: orderId,
      action: "PAYMENT_RETRY",
      actorId: customerId,
      actorType: "customer",
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
