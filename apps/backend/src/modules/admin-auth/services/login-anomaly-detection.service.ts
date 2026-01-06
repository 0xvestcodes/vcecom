import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, loginAttempts } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import type { Database } from "../../../modules/database/db";
import { DB_TOKEN } from "../../database/database.module";

export interface LoginAttemptContext {
  email: string;
  adminId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  success: boolean;
  failureReason?: string;
  sessionId?: string;
}

export interface AnomalyDetectionResult {
  score: number; // 0-100, higher = more suspicious
  flags: string[];
  isSuspicious: boolean;
}

/**
 * Login Anomaly Detection Service
 * Detects suspicious login patterns and anomalies
 */
@Injectable()
export class LoginAnomalyDetectionService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Detect anomalies in login attempt
   */
  async detectAnomalies(
    context: LoginAttemptContext,
  ): Promise<AnomalyDetectionResult> {
    const flags: string[] = [];
    let score = 0;

    try {
      // Check 1: New IP address (0-20 points)
      if (context.adminId && context.ipAddress) {
        const isNewIp = await this.isNewIpAddress(
          context.adminId,
          context.ipAddress,
        );
        if (isNewIp) {
          score += 20;
          flags.push("NEW_IP_ADDRESS");
        }
      }

      // Check 2: Multiple failed attempts followed by success (0-30 points)
      if (context.success) {
        const recentFailures = await this.getRecentFailedAttempts(
          context.email,
          context.ipAddress,
        );
        if (recentFailures > 2) {
          score += 30;
          flags.push("MULTIPLE_FAILURES_BEFORE_SUCCESS");
        }
      }

      // Check 3: Login outside normal hours (0-15 points)
      if (this.isOutsideNormalHours()) {
        score += 15;
        flags.push("OUTSIDE_NORMAL_HOURS");
      }

      // Check 4: Unusual user agent (0-15 points)
      if (this.isUnusualUserAgent(context.userAgent)) {
        score += 15;
        flags.push("UNUSUAL_USER_AGENT");
      }

      // Check 5: Rapid login attempts from multiple IPs (0-25 points)
      if (context.email) {
        const rapidAttempts = await this.hasRapidAttemptsFromMultipleIPs(
          context.email,
        );
        if (rapidAttempts) {
          score += 25;
          flags.push("RAPID_ATTEMPTS_MULTIPLE_IPS");
        }
      }

      // Check 6: Known VPN/Proxy/Tor (0-20 points)
      // This would require IP reputation service integration
      // For now, simplified check

      // Check 7: Geographic velocity (impossible travel) (0-30 points)
      // This would require IP geolocation service
      // For now, simplified check

      // Cap score at 100
      score = Math.min(score, 100);

      const isSuspicious = score >= 40; // Threshold for suspicious login

      this.logger.debug(
        createLogContext(this.contextService, "detectAnomalies", {
          email: context.email,
          adminId: context.adminId,
          score,
          flags,
          isSuspicious,
        }),
        `Login anomaly detection: score ${score}`,
      );

      return {
        score,
        flags,
        isSuspicious,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "detectAnomalies", error, {
          email: context.email,
        }),
        "Failed to detect login anomalies",
      );
      // Return low score on error to avoid blocking legitimate logins
      return {
        score: 0,
        flags: [],
        isSuspicious: false,
      };
    }
  }

  /**
   * Log login attempt
   */
  async logLoginAttempt(
    context: LoginAttemptContext,
    anomalyResult: AnomalyDetectionResult,
  ): Promise<void> {
    try {
      await this.db.insert(loginAttempts).values({
        adminId: context.adminId || null,
        email: context.email,
        status: context.success ? "SUCCESS" : "FAILED",
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        deviceId: context.deviceId || null,
        sessionId: context.sessionId || null,
        failureReason: context.failureReason || null,
        anomalyScore: anomalyResult.score.toString(),
        anomalyFlags: anomalyResult.flags,
        metadata: {
          isSuspicious: anomalyResult.isSuspicious,
        },
      });

      this.logger.info(
        createLogContext(this.contextService, "logLoginAttempt", {
          email: context.email,
          adminId: context.adminId,
          success: context.success,
          anomalyScore: anomalyResult.score,
        }),
        `Login attempt logged: ${context.success ? "SUCCESS" : "FAILED"}`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "logLoginAttempt", error, {
          email: context.email,
        }),
        "Failed to log login attempt",
      );
      // Don't throw - logging failure shouldn't break login flow
    }
  }

  /**
   * Check if IP address is new for this admin
   */
  private async isNewIpAddress(
    adminId: string,
    ipAddress: string,
  ): Promise<boolean> {
    try {
      // Check recent login attempts (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentAttempts = await this.db
        .select()
        .from(loginAttempts)
        .where(
          and(
            eq(loginAttempts.adminId, adminId),
            eq(loginAttempts.status, "SUCCESS"),
            gte(loginAttempts.createdAt, thirtyDaysAgo),
          ),
        )
        .limit(10);

      // Check if this IP was used before
      const ipUsedBefore = recentAttempts.some(
        (attempt) => attempt.ipAddress === ipAddress,
      );

      return !ipUsedBefore;
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "isNewIpAddress", error),
        "Failed to check if IP is new",
      );
      return false; // Assume not new on error
    }
  }

  /**
   * Get count of recent failed attempts
   */
  private async getRecentFailedAttempts(
    email: string,
    ipAddress?: string,
  ): Promise<number> {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const conditions = [
        eq(loginAttempts.email, email),
        eq(loginAttempts.status, "FAILED"),
        gte(loginAttempts.createdAt, oneHourAgo),
      ];

      if (ipAddress) {
        conditions.push(eq(loginAttempts.ipAddress, ipAddress));
      }

      const failedAttempts = await this.db
        .select()
        .from(loginAttempts)
        .where(and(...conditions))
        .limit(10);

      return failedAttempts.length;
    } catch (error) {
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "getRecentFailedAttempts",
          error,
        ),
        "Failed to get recent failed attempts",
      );
      return 0;
    }
  }

  /**
   * Check if login is outside normal hours (9 AM - 6 PM UTC)
   */
  private isOutsideNormalHours(): boolean {
    const hour = new Date().getUTCHours();
    return hour < 9 || hour >= 18;
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
      /python-requests/i,
      /^$/,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  /**
   * Check for rapid login attempts from multiple IPs
   */
  private async hasRapidAttemptsFromMultipleIPs(
    email: string,
  ): Promise<boolean> {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const attempts = await this.db
        .select({ ipAddress: loginAttempts.ipAddress })
        .from(loginAttempts)
        .where(
          and(
            eq(loginAttempts.email, email),
            gte(loginAttempts.createdAt, oneHourAgo),
          ),
        )
        .limit(20);

      // Count unique IPs
      const uniqueIPs = new Set(
        attempts
          .map((a) => a.ipAddress)
          .filter((ip): ip is string => ip !== null),
      );

      // If more than 3 unique IPs in last hour, it's suspicious
      return uniqueIPs.size > 3;
    } catch (error) {
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "hasRapidAttemptsFromMultipleIPs",
          error,
        ),
        "Failed to check rapid attempts",
      );
      return false;
    }
  }
}
