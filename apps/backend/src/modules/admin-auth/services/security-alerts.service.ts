import { Inject, Injectable } from "@nestjs/common";
import { eq, securityAlerts, users } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import type { Database } from "../../../modules/database/db";
import { DB_TOKEN } from "../../database/database.module";
import { NotificationsService } from "../../notifications/notifications.service";
import { NotificationType } from "../../notifications/types/notification.types";
import type { RiskScoreResult } from "./risk-scoring.service";

export interface SecurityAlertContext {
  adminId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  riskScore: RiskScoreResult;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Security Alerts Service
 * Creates and manages security alerts based on risk scores
 */
@Injectable()
export class SecurityAlertsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly notificationsService: NotificationsService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Create security alert if risk score exceeds thresholds
   */
  async createAlertIfNeeded(context: SecurityAlertContext): Promise<void> {
    const { riskScore } = context;

    // Only create alerts for MEDIUM, HIGH, or CRITICAL severity
    if (riskScore.severity === "LOW") {
      return;
    }

    try {
      // Create alert in database
      const [alert] = await this.db
        .insert(securityAlerts)
        .values({
          adminId: context.adminId,
          severity: riskScore.severity,
          status: "OPEN",
          title: this.generateAlertTitle(context),
          description: this.generateAlertDescription(context),
          alertType: "RISK_SCORE",
          riskScore: riskScore.score.toString(),
          metadata: {
            action: context.action,
            entityType: context.entityType,
            entityId: context.entityId,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            factors: riskScore.factors,
            ...context.metadata,
          },
        })
        .returning();

      this.logger.warn(
        createLogContext(this.contextService, "createSecurityAlert", {
          alertId: alert.id,
          adminId: context.adminId,
          action: context.action,
          severity: riskScore.severity,
          score: riskScore.score,
        }),
        `Security alert created: ${riskScore.severity} - ${context.action}`,
      );

      // Send notification to super admins
      await this.notifySuperAdmins(context, alert.id);

      // Send email notification for CRITICAL alerts
      if (riskScore.severity === "CRITICAL") {
        await this.sendCriticalAlertEmail(context, alert.id);
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "createSecurityAlert", error, {
          adminId: context.adminId,
          action: context.action,
        }),
        "Failed to create security alert",
      );
      // Don't throw - alert creation failure shouldn't break the operation
    }
  }

  /**
   * Generate alert title
   */
  private generateAlertTitle(context: SecurityAlertContext): string {
    const severity = context.riskScore.severity;
    const action = context.action.split(".").pop() || context.action;

    return `${severity} Risk: ${action} by Admin`;
  }

  /**
   * Generate alert description
   */
  private generateAlertDescription(context: SecurityAlertContext): string {
    const { riskScore, action, ipAddress } = context;
    const factors = riskScore.factors.join(", ");

    let description = `Admin action "${action}" triggered a ${riskScore.severity} risk alert (score: ${riskScore.score}/100).\n\n`;
    description += `Risk Factors: ${factors}\n`;

    if (ipAddress) {
      description += `IP Address: ${ipAddress}\n`;
    }

    if (context.entityId) {
      description += `Entity ID: ${context.entityId}\n`;
    }

    return description;
  }

  /**
   * Notify super admins via in-app notifications
   */
  private async notifySuperAdmins(
    context: SecurityAlertContext,
    alertId: string,
  ): Promise<void> {
    try {
      // Get all admin users
      const adminUsers = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(10); // Limit to prevent spam

      // Send notification to each admin
      for (const admin of adminUsers) {
        await this.notificationsService.createFromEvent({
          adminId: admin.id,
          type: NotificationType.SECURITY,
          title: this.generateAlertTitle(context),
          message: this.generateAlertDescription(context),
          meta: {
            alertId,
            severity: context.riskScore.severity,
            score: context.riskScore.score,
            action: context.action,
          },
        });
      }

      // Also send broadcast notification
      await this.notificationsService.createFromEvent({
        adminId: null, // Broadcast
        type: NotificationType.SECURITY,
        title: this.generateAlertTitle(context),
        message: this.generateAlertDescription(context),
        meta: {
          alertId,
          severity: context.riskScore.severity,
          score: context.riskScore.score,
          action: context.action,
        },
      });
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "notifySuperAdmins", error),
        "Failed to notify super admins",
      );
    }
  }

  /**
   * Send email notification for critical alerts
   */
  private async sendCriticalAlertEmail(
    context: SecurityAlertContext,
    alertId: string,
  ): Promise<void> {
    // Email sending would be implemented here
    // For now, just log
    this.logger.warn(
      createLogContext(this.contextService, "sendCriticalAlertEmail", {
        alertId,
        adminId: context.adminId,
        action: context.action,
      }),
      "CRITICAL security alert - email notification should be sent",
    );
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
  ): Promise<void> {
    try {
      await this.db
        .update(securityAlerts)
        .set({
          status: "ACKNOWLEDGED",
          acknowledgedBy,
          acknowledgedAt: new Date(),
        })
        .where(eq(securityAlerts.id, alertId));

      this.logger.info(
        createLogContext(this.contextService, "acknowledgeAlert", {
          alertId,
          acknowledgedBy,
        }),
        "Security alert acknowledged",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "acknowledgeAlert", error, {
          alertId,
        }),
        "Failed to acknowledge alert",
      );
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    try {
      await this.db
        .update(securityAlerts)
        .set({
          status: "RESOLVED",
          resolvedAt: new Date(),
        })
        .where(eq(securityAlerts.id, alertId));

      this.logger.info(
        createLogContext(this.contextService, "resolveAlert", { alertId }),
        "Security alert resolved",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "resolveAlert", error, {
          alertId,
        }),
        "Failed to resolve alert",
      );
      throw error;
    }
  }
}
