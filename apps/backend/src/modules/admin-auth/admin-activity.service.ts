import { Inject, Injectable } from "@nestjs/common";
import { adminActivityLogs } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";

export interface LogActivityParams {
  adminId: string;
  action: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  diff?: {
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  };
}

@Injectable()
export class AdminActivityService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Log admin activity to both database and structured logs
   */
  async logActivity(params: LogActivityParams): Promise<void> {
    const {
      adminId,
      action,
      entityId,
      metadata,
      ipAddress: providedIp,
      userAgent: providedUserAgent,
      diff,
    } = params;

    // Extract IP and userAgent from context if not provided
    const context = this.contextService.get();
    const ipAddress = providedIp || context?.ip || "unknown";
    const userAgent = providedUserAgent || "unknown";

    try {
      // Log to database (append-only)
      await this.db.insert(adminActivityLogs).values({
        adminId,
        action,
        entityId: entityId || null,
        metadata: metadata ? (metadata as Record<string, unknown>) : null,
        diff: diff
          ? ({
              before: diff.before,
              after: diff.after,
            } as Record<string, unknown>)
          : null,
        ipAddress,
        userAgent,
      });

      // Also log to structured logs using PinoLogger
      this.logger.info(
        createLogContext(this.contextService, "adminActivity", {
          adminId,
          action,
          entityId,
          metadata,
          diff,
          ipAddress,
          userAgent,
        }),
        `Admin activity: ${action}`,
      );
    } catch (error) {
      // Log error but don't throw - activity logging should not break the main flow
      this.logger.error(
        createErrorContext(this.contextService, "logActivity", error, {
          adminId,
          action,
        }),
        "Failed to log admin activity",
      );
    }
  }

  /**
   * Log login activity
   */
  async logLogin(adminId: string, deviceId: string): Promise<void> {
    await this.logActivity({
      adminId,
      action: "admin.login",
      metadata: { deviceId },
    });
  }

  /**
   * Log logout activity
   */
  async logLogout(adminId: string, sessionId?: string): Promise<void> {
    await this.logActivity({
      adminId,
      action: "admin.logout",
      metadata: sessionId ? { sessionId } : undefined,
    });
  }

  /**
   * Log session revocation
   */
  async logSessionRevoke(
    adminId: string,
    revokedSessionId: string,
    revokedBy: string,
  ): Promise<void> {
    await this.logActivity({
      adminId,
      action: "admin.session.revoke",
      entityId: revokedSessionId,
      metadata: { revokedBy },
    });
  }

  /**
   * Log admin activity with before/after diff
   */
  async logActivityWithDiff(
    params: LogActivityParams & {
      diff: {
        before: Record<string, unknown> | null;
        after: Record<string, unknown> | null;
      };
    },
  ): Promise<void> {
    await this.logActivity({
      ...params,
      diff: params.diff,
    });
  }
}
