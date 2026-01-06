import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";

export interface RiskScoreContext {
  action: string;
  entityType?: string;
  entityId?: string;
  adminId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface RiskScoreResult {
  score: number; // 0-100
  factors: string[];
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/**
 * Risk Scoring Service
 * Calculates risk scores for admin actions based on various factors
 */
@Injectable()
export class RiskScoringService {
  private readonly warningThreshold: number;
  private readonly criticalThreshold: number;

  // High-risk actions that should trigger alerts
  private readonly highRiskActions = new Set([
    "user.delete",
    "user.role.change",
    "admin.delete",
    "admin.role.change",
    "order.refund",
    "order.cancel",
    "payment.refund",
    "discount.delete",
    "product.delete",
    "inventory.bulk.adjust",
    "settings.update",
    "webhook.delete",
    "webhook.update",
  ]);

  // Bulk operations
  private readonly bulkOperationPatterns = [
    /bulk/i,
    /batch/i,
    /mass/i,
    /multiple/i,
  ];

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    this.warningThreshold = parseInt(
      process.env.RISK_ALERT_THRESHOLD_WARNING || "50",
      10,
    );
    this.criticalThreshold = parseInt(
      process.env.RISK_ALERT_THRESHOLD_CRITICAL || "75",
      10,
    );
  }

  /**
   * Calculate risk score for an admin action
   */
  async calculateRiskScore(
    context: RiskScoreContext,
  ): Promise<RiskScoreResult> {
    const factors: string[] = [];
    let score = 0;

    try {
      // Factor 1: High-risk actions (0-30 points)
      if (this.isHighRiskAction(context.action)) {
        score += 30;
        factors.push("HIGH_RISK_ACTION");
      }

      // Factor 2: Bulk operations (0-20 points)
      if (this.isBulkOperation(context)) {
        score += 20;
        factors.push("BULK_OPERATION");
      }

      // Factor 3: Actions outside business hours (0-15 points)
      if (this.isOutsideBusinessHours(context.timestamp)) {
        score += 15;
        factors.push("OUTSIDE_BUSINESS_HOURS");
      }

      // Factor 4: Rapid-fire actions (0-20 points)
      // This would require checking recent actions - simplified for now
      // In production, query recent actions from activity logs

      // Factor 5: New IP address (0-15 points)
      if (await this.isNewIpAddress(context.adminId, context.ipAddress)) {
        score += 15;
        factors.push("NEW_IP_ADDRESS");
      }

      // Factor 6: Unusual user agent (0-10 points)
      if (this.isUnusualUserAgent(context.userAgent)) {
        score += 10;
        factors.push("UNUSUAL_USER_AGENT");
      }

      // Factor 7: Large monetary operations (0-25 points)
      if (this.isLargeMonetaryOperation(context)) {
        score += 25;
        factors.push("LARGE_MONETARY_OPERATION");
      }

      // Factor 8: Role/permission changes (0-30 points)
      if (this.isRoleOrPermissionChange(context)) {
        score += 30;
        factors.push("ROLE_PERMISSION_CHANGE");
      }

      // Cap score at 100
      score = Math.min(score, 100);

      // Determine severity
      const severity = this.determineSeverity(score);

      this.logger.debug(
        createLogContext(this.contextService, "calculateRiskScore", {
          adminId: context.adminId,
          action: context.action,
          score,
          factors,
          severity,
        }),
        `Risk score calculated: ${score}`,
      );

      return {
        score,
        factors,
        severity,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "calculateRiskScore", error, {
          adminId: context.adminId,
          action: context.action,
        }),
        "Failed to calculate risk score",
      );
      // Return low risk on error to avoid blocking operations
      return {
        score: 0,
        factors: [],
        severity: "LOW",
      };
    }
  }

  /**
   * Check if action is high-risk
   */
  private isHighRiskAction(action: string): boolean {
    return this.highRiskActions.has(action);
  }

  /**
   * Check if operation is bulk
   */
  private isBulkOperation(context: RiskScoreContext): boolean {
    // Check action name
    if (
      this.bulkOperationPatterns.some((pattern) => pattern.test(context.action))
    ) {
      return true;
    }

    // Check metadata for bulk indicators
    if (context.metadata) {
      const metadataStr = JSON.stringify(context.metadata).toLowerCase();
      if (
        this.bulkOperationPatterns.some((pattern) => pattern.test(metadataStr))
      ) {
        return true;
      }

      // Check for array operations with multiple items
      if (
        Array.isArray(context.metadata.items) &&
        context.metadata.items.length > 10
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if action is outside business hours (9 AM - 6 PM UTC)
   */
  private isOutsideBusinessHours(timestamp: Date): boolean {
    const hour = timestamp.getUTCHours();
    return hour < 9 || hour >= 18;
  }

  /**
   * Check if IP address is new for this admin
   * Simplified version - in production, query from activity logs
   */
  private async isNewIpAddress(
    adminId: string,
    ipAddress?: string,
  ): Promise<boolean> {
    if (!ipAddress || ipAddress === "unknown") {
      return false;
    }

    // In production, query admin_activity_logs for recent IPs
    // For now, return false (would need database access)
    // This should be implemented with actual database query
    return false;
  }

  /**
   * Check if user agent is unusual
   */
  private isUnusualUserAgent(userAgent?: string): boolean {
    if (!userAgent) {
      return true; // Missing user agent is suspicious
    }

    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /^$/,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  /**
   * Check if operation involves large monetary amounts
   */
  private isLargeMonetaryOperation(context: RiskScoreContext): boolean {
    if (!context.metadata) {
      return false;
    }

    // Check for refund amounts
    const refundAmount =
      context.metadata.refundAmount ||
      context.metadata.amount ||
      context.metadata.total;

    if (typeof refundAmount === "number" && refundAmount > 10000) {
      return true;
    }

    // Check for order totals
    const orderTotal = context.metadata.orderTotal || context.metadata.total;
    if (typeof orderTotal === "number" && orderTotal > 50000) {
      return true;
    }

    return false;
  }

  /**
   * Check if action involves role or permission changes
   */
  private isRoleOrPermissionChange(context: RiskScoreContext): boolean {
    return (
      context.action.includes("role") ||
      context.action.includes("permission") ||
      context.action.includes("admin") ||
      (context.metadata !== undefined &&
        (context.metadata.role !== undefined ||
          context.metadata.permissions !== undefined)) ||
      false
    );
  }

  /**
   * Determine severity based on score
   */
  private determineSeverity(
    score: number,
  ): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (score >= this.criticalThreshold) {
      return "CRITICAL";
    }
    if (score >= this.warningThreshold) {
      return "HIGH";
    }
    if (score >= this.warningThreshold / 2) {
      return "MEDIUM";
    }
    return "LOW";
  }
}
