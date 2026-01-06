import { Inject, Injectable } from "@nestjs/common";
import { and, customerSessions, desc, eq } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceType?: "mobile" | "desktop" | "tablet";
  browser?: string;
  os?: string;
  country?: string;
  city?: string;
}

@Injectable()
export class CustomerSessionService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Parse user agent to extract device/browser info (basic parsing)
   */
  private parseUserAgent(userAgent: string | null): {
    deviceType?: "mobile" | "desktop" | "tablet";
    browser?: string;
    os?: string;
  } {
    if (!userAgent) {
      return {};
    }

    try {
      const ua = userAgent.toLowerCase();

      // Detect device type
      let deviceType: "mobile" | "desktop" | "tablet" | undefined;
      if (
        ua.includes("mobile") ||
        ua.includes("android") ||
        ua.includes("iphone")
      ) {
        deviceType = "mobile";
      } else if (ua.includes("tablet") || ua.includes("ipad")) {
        deviceType = "tablet";
      } else {
        deviceType = "desktop";
      }

      // Extract browser (basic)
      let browser: string | undefined;
      if (ua.includes("chrome") && !ua.includes("edg")) {
        browser = "Chrome";
      } else if (ua.includes("firefox")) {
        browser = "Firefox";
      } else if (ua.includes("safari") && !ua.includes("chrome")) {
        browser = "Safari";
      } else if (ua.includes("edg")) {
        browser = "Edge";
      } else if (ua.includes("opera")) {
        browser = "Opera";
      }

      // Extract OS (basic)
      let os: string | undefined;
      if (ua.includes("windows")) {
        os = "Windows";
      } else if (ua.includes("mac os") || ua.includes("macos")) {
        os = "macOS";
      } else if (ua.includes("linux")) {
        os = "Linux";
      } else if (ua.includes("android")) {
        os = "Android";
      } else if (
        ua.includes("ios") ||
        ua.includes("iphone") ||
        ua.includes("ipad")
      ) {
        os = "iOS";
      }

      return {
        deviceType,
        browser,
        os,
      };
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "parseUserAgent", error, {
          userAgent,
        }),
        "Failed to parse user agent",
      );
      return {};
    }
  }

  /**
   * Create or update session with metadata
   */
  async createOrUpdateSession(
    sessionId: string,
    customerId?: string | null,
    cartId?: string | null,
    metadata?: SessionMetadata,
  ): Promise<typeof customerSessions.$inferSelect> {
    try {
      // Get IP and user agent from context if not provided
      const context = this.contextService.get();
      const ipAddress = metadata?.ipAddress || context?.ip || null;
      const userAgent = metadata?.userAgent || context?.userAgent || null;

      // Parse user agent
      const parsedUA = this.parseUserAgent(userAgent || null);

      // Check if session exists
      const [existing] = await this.db
        .select()
        .from(customerSessions)
        .where(eq(customerSessions.sessionId, sessionId))
        .limit(1);

      const now = new Date();

      if (existing) {
        // Update existing session
        const [updated] = await this.db
          .update(customerSessions)
          .set({
            customerId:
              customerId !== undefined ? customerId : existing.customerId,
            cartId: cartId !== undefined ? cartId : existing.cartId,
            ipAddress: ipAddress || existing.ipAddress,
            userAgent: userAgent || existing.userAgent,
            deviceType: parsedUA.deviceType || existing.deviceType,
            browser: parsedUA.browser || existing.browser,
            os: parsedUA.os || existing.os,
            country: metadata?.country || existing.country,
            city: metadata?.city || existing.city,
            lastSeenAt: now,
            isActive: true,
          })
          .where(eq(customerSessions.id, existing.id))
          .returning();

        return updated;
      } else {
        // Create new session
        const [created] = await this.db
          .insert(customerSessions)
          .values({
            sessionId,
            customerId: customerId || null,
            cartId: cartId || null,
            ipAddress,
            userAgent,
            deviceType: parsedUA.deviceType,
            browser: parsedUA.browser,
            os: parsedUA.os,
            country: metadata?.country,
            city: metadata?.city,
            firstSeenAt: now,
            lastSeenAt: now,
            isActive: true,
          })
          .returning();

        return created;
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "createOrUpdateSession",
          error,
          {
            sessionId,
            customerId,
          },
        ),
        "Failed to create or update session",
      );
      throw error;
    }
  }

  /**
   * Get session details
   */
  async getSession(
    sessionId: string,
  ): Promise<typeof customerSessions.$inferSelect | null> {
    try {
      const [session] = await this.db
        .select()
        .from(customerSessions)
        .where(eq(customerSessions.sessionId, sessionId))
        .limit(1);

      return session || null;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getSession", error, {
          sessionId,
        }),
        "Failed to get session",
      );
      return null;
    }
  }

  /**
   * Update session activity (last seen timestamp)
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await this.db
        .update(customerSessions)
        .set({
          lastSeenAt: new Date(),
          isActive: true,
        })
        .where(eq(customerSessions.sessionId, sessionId));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "updateSessionActivity",
          error,
          {
            sessionId,
          },
        ),
        "Failed to update session activity",
      );
      // Don't throw - non-critical
    }
  }

  /**
   * Get active sessions for a customer
   */
  async getActiveSessions(
    customerId: string,
    limit = 10,
  ): Promise<(typeof customerSessions.$inferSelect)[]> {
    try {
      const sessions = await this.db
        .select()
        .from(customerSessions)
        .where(
          and(
            eq(customerSessions.customerId, customerId),
            eq(customerSessions.isActive, true),
          ),
        )
        .orderBy(desc(customerSessions.lastSeenAt))
        .limit(limit);

      return sessions;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getActiveSessions", error, {
          customerId,
        }),
        "Failed to get active sessions",
      );
      return [];
    }
  }

  /**
   * Mark session as inactive
   */
  async deactivateSession(sessionId: string): Promise<void> {
    try {
      await this.db
        .update(customerSessions)
        .set({ isActive: false })
        .where(eq(customerSessions.sessionId, sessionId));
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "deactivateSession", error, {
          sessionId,
        }),
        "Failed to deactivate session",
      );
    }
  }
}
