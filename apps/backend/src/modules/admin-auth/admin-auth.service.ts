import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { eq, users } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import { AdminActivityService } from "./admin-activity.service";
import { AdminMfaService } from "./admin-mfa.service";
import { AdminSessionsService } from "./admin-sessions.service";
import {
  isBcryptHash,
  migratePasswordHash,
  verifyPassword,
} from "./utils/password.utils";

export interface AdminLoginResult {
  admin: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
  requires2fa: boolean;
  deviceId: string;
}

@Injectable()
export class AdminAuthService {
  private readonly accessTokenExpiresIn: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionsService: AdminSessionsService,
    private readonly activityService: AdminActivityService,
    private readonly mfaService: AdminMfaService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {
    this.accessTokenExpiresIn =
      process.env.ADMIN_ACCESS_TOKEN_EXPIRES_IN || "15m";
  }

  /**
   * Validate admin credentials (email and password)
   */
  async validateAdminCredentials(
    email: string,
    password: string,
  ): Promise<{
    id: string;
    email: string;
    role: string;
    passwordHash: string;
  }> {
    const [admin] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!admin) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Check if admin role (any admin role)
    const adminRoles = ["admin", "support", "reviewer", "marketing"];
    if (!adminRoles.includes(admin.role)) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Admin users must have a password hash
    if (!admin.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Verify password (supports both argon2id and bcrypt)
    const isValid = await verifyPassword(admin.passwordHash, password);

    if (!isValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Migrate bcrypt to argon2id on successful login
    if (isBcryptHash(admin.passwordHash)) {
      try {
        const newHash = await migratePasswordHash(password, admin.passwordHash);
        await this.db
          .update(users)
          .set({ passwordHash: newHash })
          .where(eq(users.id, admin.id));

        this.logger.info(
          createLogContext(this.contextService, "passwordMigrated", {
            adminId: admin.id,
          }),
          "Admin password migrated from bcrypt to argon2id",
        );
      } catch (error) {
        this.logger.error(
          createErrorContext(this.contextService, "passwordMigration", error, {
            adminId: admin.id,
          }),
          "Failed to migrate password hash",
        );
        // Continue with login even if migration fails
      }
    }

    return {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      passwordHash: admin.passwordHash,
    };
  }

  /**
   * Login admin and create session
   */
  async login(
    admin: { id: string; email: string; role: string },
    deviceId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AdminLoginResult> {
    // Check if 2FA is enabled
    const requires2fa = await this.mfaService.is2FAEnabled(admin.id);

    // If 2FA is required, don't create session yet - return requires2fa flag
    if (requires2fa) {
      this.logger.info(
        createLogContext(this.contextService, "adminLogin2FARequired", {
          adminId: admin.id,
          deviceId,
        }),
        "Admin login requires 2FA verification",
      );

      return {
        admin: {
          id: admin.id,
          email: admin.email,
          role: admin.role,
        },
        accessToken: "", // No token until 2FA is verified
        refreshToken: "", // No token until 2FA is verified
        requires2fa: true,
        deviceId,
      };
    }

    // Create session
    const { sessionId, refreshToken } =
      await this.sessionsService.createSession({
        adminId: admin.id,
        deviceId,
        userAgent,
        ipAddress,
      });

    // Generate access token
    const accessToken = this.jwtService.sign(
      {
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        sessionId,
        type: "admin",
      },
      {
        expiresIn: this.accessTokenExpiresIn,
      },
    );

    // Log login activity
    await this.activityService.logLogin(admin.id, deviceId);

    this.logger.info(
      createLogContext(this.contextService, "adminLogin", {
        adminId: admin.id,
        deviceId,
        sessionId,
      }),
      "Admin logged in",
    );

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
      accessToken,
      refreshToken,
      requires2fa,
      deviceId,
    };
  }

  /**
   * Refresh access token with rotation
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      // Validate refresh token and get session
      const session =
        await this.sessionsService.validateRefreshToken(refreshToken);

      // Get admin info
      const [admin] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, session.adminId))
        .limit(1);

      if (!admin) {
        throw new UnauthorizedException("Admin not found");
      }

      // Generate new refresh token (rotation)
      const newRefreshToken = randomUUID();
      await this.sessionsService.updateRefreshToken(
        session.sessionId,
        newRefreshToken,
      );

      // Update last used timestamp
      await this.sessionsService.updateLastUsedAt(session.sessionId);

      // Generate new access token
      const accessToken = this.jwtService.sign(
        {
          sub: admin.id,
          email: admin.email,
          role: admin.role,
          sessionId: session.sessionId,
          type: "admin",
        },
        {
          expiresIn: this.accessTokenExpiresIn,
        },
      );

      this.logger.debug(
        createLogContext(this.contextService, "adminTokenRefresh", {
          adminId: admin.id,
          sessionId: session.sessionId,
        }),
        "Admin access token refreshed",
      );

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        createErrorContext(this.contextService, "refreshAccessToken", error),
        "Failed to refresh access token",
      );
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  /**
   * Logout single device
   */
  async logout(sessionId: string, adminId: string): Promise<void> {
    await this.sessionsService.deleteSession(sessionId);
    await this.activityService.logLogout(adminId, sessionId);

    this.logger.info(
      createLogContext(this.contextService, "adminLogout", {
        adminId,
        sessionId,
      }),
      "Admin logged out",
    );
  }

  /**
   * Logout all devices
   */
  async logoutAll(adminId: string): Promise<void> {
    const deletedCount = await this.sessionsService.deleteAllSessions(adminId);
    await this.activityService.logLogout(adminId);

    this.logger.info(
      createLogContext(this.contextService, "adminLogoutAll", {
        adminId,
        deletedCount,
      }),
      "Admin logged out from all devices",
    );
  }

  /**
   * Verify 2FA and complete login
   */
  async verify2FAAndLogin(
    email: string,
    code: string,
    deviceId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AdminLoginResult> {
    // Validate credentials first
    // We need to get admin without password validation here, as password was already validated in initial login
    const [adminUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!adminUser) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Check if 2FA is enabled
    const is2FAEnabled = await this.mfaService.is2FAEnabled(adminUser.id);
    if (!is2FAEnabled) {
      throw new BadRequestException("2FA is not enabled for this account");
    }

    // Verify 2FA code
    const isValid = await this.mfaService.verify2FA(adminUser.id, code);
    if (!isValid) {
      throw new UnauthorizedException("Invalid 2FA code");
    }

    // Now proceed with normal login
    return this.login(
      {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      },
      deviceId,
      userAgent,
      ipAddress,
    );
  }

  /**
   * Get admin info with session count
   */
  async getAdminInfo(adminId: string): Promise<{
    id: string;
    email: string;
    role: string;
    activeSessionsCount: number;
    has2fa: boolean;
  }> {
    const [admin] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, adminId))
      .limit(1);

    if (!admin) {
      throw new NotFoundException("Admin not found");
    }

    const sessions = await this.sessionsService.getActiveSessions(adminId);

    // Check if 2FA is enabled
    const has2fa = await this.mfaService.is2FAEnabled(adminId);

    return {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      activeSessionsCount: sessions.length,
      has2fa,
    };
  }
}
