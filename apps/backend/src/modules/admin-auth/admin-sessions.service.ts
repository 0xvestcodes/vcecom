import { randomUUID } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { adminSessions, eq, gte } from "@vcecom/db";
import * as argon2 from "argon2";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";

export interface CreateSessionParams {
  adminId: string;
  deviceId: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionInfo {
  id: string;
  deviceId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
}

@Injectable()
export class AdminSessionsService {
  private readonly refreshTokenExpiryDays: number;

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {
    this.refreshTokenExpiryDays =
      parseInt(process.env.ADMIN_REFRESH_TOKEN_EXPIRY_DAYS || "90", 10) || 90;
  }

  /**
   * Create a new admin session with refresh token
   */
  async createSession(params: CreateSessionParams): Promise<{
    sessionId: string;
    refreshToken: string;
    refreshTokenHash: string;
  }> {
    const { adminId, deviceId, userAgent, ipAddress } = params;

    // Generate refresh token (UUID-based for rotation safety)
    const refreshToken = randomUUID();
    const refreshTokenHash = await argon2.hash(refreshToken);

    // Calculate expiry dates
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiryDays);

    try {
      const [session] = await this.db
        .insert(adminSessions)
        .values({
          adminId,
          refreshTokenHash,
          deviceId,
          userAgent,
          ipAddress,
          expiresAt,
          lastUsedAt: now,
        })
        .returning();

      this.logger.info(
        createLogContext(this.contextService, "createSession", {
          sessionId: session.id,
          adminId,
          deviceId,
        }),
        "Admin session created",
      );

      return {
        sessionId: session.id,
        refreshToken,
        refreshTokenHash,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "createSession", error, {
          adminId,
          deviceId,
        }),
        "Failed to create admin session",
      );
      throw error;
    }
  }

  /**
   * Find session by refresh token hash
   */
  async findSessionByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<{ id: string; adminId: string; deviceId: string } | null> {
    try {
      const [session] = await this.db
        .select({
          id: adminSessions.id,
          adminId: adminSessions.adminId,
          deviceId: adminSessions.deviceId,
        })
        .from(adminSessions)
        .where(eq(adminSessions.refreshTokenHash, refreshTokenHash))
        .limit(1);

      if (!session) {
        return null;
      }

      // Check if session is expired
      const [fullSession] = await this.db
        .select({
          expiresAt: adminSessions.expiresAt,
        })
        .from(adminSessions)
        .where(eq(adminSessions.id, session.id))
        .limit(1);

      if (fullSession && new Date(fullSession.expiresAt) < new Date()) {
        // Session expired, delete it
        await this.deleteSession(session.id);
        return null;
      }

      return session;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "findSessionByRefreshTokenHash",
          error,
        ),
        "Failed to find session by refresh token hash",
      );
      return null;
    }
  }

  /**
   * Update refresh token (rotation)
   */
  async updateRefreshToken(
    sessionId: string,
    newRefreshToken: string,
  ): Promise<string> {
    const newRefreshTokenHash = await argon2.hash(newRefreshToken);

    try {
      await this.db
        .update(adminSessions)
        .set({
          refreshTokenHash: newRefreshTokenHash,
          lastUsedAt: new Date(),
        })
        .where(eq(adminSessions.id, sessionId));

      this.logger.debug(
        createLogContext(this.contextService, "updateRefreshToken", {
          sessionId,
        }),
        "Refresh token rotated",
      );

      return newRefreshTokenHash;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "updateRefreshToken", error, {
          sessionId,
        }),
        "Failed to update refresh token",
      );
      throw error;
    }
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsedAt(sessionId: string): Promise<void> {
    try {
      await this.db
        .update(adminSessions)
        .set({ lastUsedAt: new Date() })
        .where(eq(adminSessions.id, sessionId));
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "updateLastUsedAt", error, {
          sessionId,
        }),
        "Failed to update last used timestamp",
      );
    }
  }

  /**
   * Delete a single session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.db
        .delete(adminSessions)
        .where(eq(adminSessions.id, sessionId));

      this.logger.info(
        createLogContext(this.contextService, "deleteSession", { sessionId }),
        "Admin session deleted",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "deleteSession", error, {
          sessionId,
        }),
        "Failed to delete session",
      );
      throw error;
    }
  }

  /**
   * Delete all sessions for an admin
   */
  async deleteAllSessions(adminId: string): Promise<number> {
    try {
      const result = await this.db
        .delete(adminSessions)
        .where(eq(adminSessions.adminId, adminId))
        .returning();

      this.logger.info(
        createLogContext(this.contextService, "deleteAllSessions", {
          adminId,
          deletedCount: result.length,
        }),
        "All admin sessions deleted",
      );

      return result.length;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "deleteAllSessions", error, {
          adminId,
        }),
        "Failed to delete all sessions",
      );
      throw error;
    }
  }

  /**
   * Get all active sessions for an admin
   */
  async getActiveSessions(adminId: string): Promise<SessionInfo[]> {
    try {
      const sessions = await this.db
        .select({
          id: adminSessions.id,
          deviceId: adminSessions.deviceId,
          userAgent: adminSessions.userAgent,
          ipAddress: adminSessions.ipAddress,
          createdAt: adminSessions.createdAt,
          expiresAt: adminSessions.expiresAt,
          lastUsedAt: adminSessions.lastUsedAt,
        })
        .from(adminSessions)
        .where(eq(adminSessions.adminId, adminId));

      // Filter out expired sessions and map to SessionInfo
      const now = new Date();
      return sessions
        .filter((session) => session.expiresAt > now)
        .map((session) => ({
          id: session.id,
          deviceId: session.deviceId,
          userAgent: session.userAgent ?? undefined,
          ipAddress: session.ipAddress ?? undefined,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          lastUsedAt: session.lastUsedAt,
        }));
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getActiveSessions", error, {
          adminId,
        }),
        "Failed to get active sessions",
      );
      return [];
    }
  }

  /**
   * Invalidate session on rotation detection (token reuse)
   */
  async invalidateSessionOnRotation(sessionId: string): Promise<void> {
    this.logger.warn(
      createLogContext(this.contextService, "invalidateSessionOnRotation", {
        sessionId,
      }),
      "Session invalidated due to refresh token reuse (rotation attack detected)",
    );
    await this.deleteSession(sessionId);
  }

  /**
   * Validate refresh token and return session
   */
  async validateRefreshToken(
    refreshToken: string,
  ): Promise<{ sessionId: string; adminId: string; deviceId: string }> {
    // Get all non-expired sessions and check each refresh token hash
    // This approach is necessary for rotation detection
    const now = new Date();
    const allSessions = await this.db
      .select({
        id: adminSessions.id,
        adminId: adminSessions.adminId,
        deviceId: adminSessions.deviceId,
        refreshTokenHash: adminSessions.refreshTokenHash,
        expiresAt: adminSessions.expiresAt,
      })
      .from(adminSessions)
      .where(gte(adminSessions.expiresAt, now));

    // Check each session's refresh token hash
    for (const session of allSessions) {
      try {
        const isValid = await argon2.verify(
          session.refreshTokenHash,
          refreshToken,
        );
        if (isValid) {
          return {
            sessionId: session.id,
            adminId: session.adminId,
            deviceId: session.deviceId,
          };
        }
      } catch {}
    }

    throw new UnauthorizedException("Invalid or expired refresh token");
  }
}
