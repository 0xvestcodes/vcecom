import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { PinoLogger } from "nestjs-pino";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AdminAuthService } from "./admin-auth.service";
import { AdminSessionsService } from "./admin-sessions.service";
import {
  AdminAuthResponseDto,
  AdminMeResponseDto,
  AdminSessionsResponseDto,
} from "./dto/admin-auth-response.dto";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { Verify2FALoginDto } from "./dto/verify-2fa-login.dto";
import { AdminLoginRateLimitGuard } from "./guards/rate-limit.guard";
import { IpHeuristicsService } from "./services/ip-heuristics.service";
import { LoginAnomalyDetectionService } from "./services/login-anomaly-detection.service";
import { SecretRotationService } from "./services/secret-rotation.service";

@ApiTags("admin")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly sessionsService: AdminSessionsService,
    private readonly secretRotationService: SecretRotationService,
    private readonly loginAnomalyDetectionService: LoginAnomalyDetectionService,
    private readonly ipHeuristicsService: IpHeuristicsService,
    readonly _jwtService: JwtService,
    private readonly logger: PinoLogger,
  ) {}

  @Public()
  @Post("login")
  @UseGuards(AdminLoginRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Admin login",
    description:
      "Authenticate admin with email and password. Returns access token, refresh token, and admin info. Sets httpOnly cookies.",
  })
  @ApiOkResponse({
    description: "Admin successfully authenticated",
    type: AdminAuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Invalid credentials",
  })
  @ApiTooManyRequestsResponse({
    description: "Too many login attempts",
  })
  @ApiBadRequestResponse({
    description: "Invalid input",
  })
  async login(
    @Body() loginDto: AdminLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminAuthResponseDto> {
    // Extract user agent and IP from request
    const userAgent = req.headers["user-agent"];
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      "unknown";

    // Run IP heuristics analysis
    const ipHeuristics = await this.ipHeuristicsService.analyzeIp(
      ipAddress,
      userAgent,
      req.headers as Record<string, string | string[] | undefined>,
    );

    // Block if IP reputation score is too high
    if (ipHeuristics.shouldBlock) {
      this.logger.warn(
        {
          ipAddress,
          reputationScore: ipHeuristics.reputationScore,
          riskFactors: ipHeuristics.riskFactors,
        },
        "Login blocked due to high IP reputation score",
      );
      throw new UnauthorizedException("Access denied due to security policy");
    }

    let admin:
      | Awaited<
          ReturnType<typeof this.adminAuthService.validateAdminCredentials>
        >
      | undefined;
    let _loginSuccess = false;
    let failureReason: string | undefined;

    try {
      // Validate credentials
      admin = await this.adminAuthService.validateAdminCredentials(
        loginDto.email,
        loginDto.password,
      );
      _loginSuccess = true;
    } catch (error) {
      _loginSuccess = false;
      failureReason =
        error instanceof Error ? error.message : "Invalid credentials";

      // Log failed login attempt with anomaly detection
      const anomalyResult =
        await this.loginAnomalyDetectionService.detectAnomalies({
          email: loginDto.email,
          ipAddress,
          userAgent,
          deviceId: loginDto.deviceId,
          success: false,
          failureReason,
        });

      await this.loginAnomalyDetectionService.logLoginAttempt(
        {
          email: loginDto.email,
          ipAddress,
          userAgent,
          deviceId: loginDto.deviceId,
          success: false,
          failureReason,
        },
        anomalyResult,
      );

      // Re-throw the error
      throw error;
    }

    // Login and create session
    if (!admin) {
      throw new UnauthorizedException("Admin validation failed");
    }
    const result = await this.adminAuthService.login(
      admin,
      loginDto.deviceId,
      userAgent,
      ipAddress,
    );

    // Detect anomalies for successful login (after session is created)
    // Extract session ID from access token if available
    let sessionId: string | undefined;
    if (result.accessToken && !result.requires2fa) {
      try {
        // Decode JWT to get sessionId (without verification, just for logging)
        const payload = JSON.parse(
          Buffer.from(result.accessToken.split(".")[1], "base64").toString(),
        );
        sessionId = payload.sessionId;
      } catch {
        // Ignore decode errors
      }
    }

    const anomalyResult =
      await this.loginAnomalyDetectionService.detectAnomalies({
        email: loginDto.email,
        adminId: admin.id,
        ipAddress,
        userAgent,
        deviceId: loginDto.deviceId,
        success: true,
        sessionId,
      });

    // Log successful login attempt
    await this.loginAnomalyDetectionService.logLoginAttempt(
      {
        email: loginDto.email,
        adminId: admin.id,
        ipAddress,
        userAgent,
        deviceId: loginDto.deviceId,
        success: true,
        sessionId,
      },
      anomalyResult,
    );

    // If suspicious, log warning (but don't block login)
    if (anomalyResult.isSuspicious) {
      // This would trigger a security alert
      // For now, just log
    }

    // If 2FA is required, don't set cookies - client needs to verify 2FA first
    if (result.requires2fa) {
      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        id: result.admin.id,
        email: result.admin.email,
        role: result.admin.role as
          | "admin"
          | "customer"
          | "support"
          | "reviewer"
          | "marketing",
        requires2fa: result.requires2fa,
      };
    }

    // Set httpOnly cookies
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ("strict" as const) : ("lax" as const), // Strict in production for CSRF protection
      path: "/",
    };

    res.cookie("admin_access_token", result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("admin_refresh_token", result.refreshToken, {
      ...cookieOptions,
      maxAge:
        parseInt(process.env.ADMIN_REFRESH_TOKEN_EXPIRY_DAYS || "90", 10) *
        24 *
        60 *
        60 *
        1000, // 90 days default
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      id: result.admin.id,
      email: result.admin.email,
      role: result.admin.role as
        | "admin"
        | "customer"
        | "support"
        | "reviewer"
        | "marketing",
      requires2fa: result.requires2fa,
    };
  }

  @Public()
  @Post("2fa/verify")
  @UseGuards(AdminLoginRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify 2FA and complete admin login",
    description:
      "Verify TOTP code or backup code to complete admin login when 2FA is enabled. Returns access and refresh tokens.",
  })
  @ApiOkResponse({
    description: "2FA verified and admin successfully logged in",
    type: AdminAuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Invalid 2FA code or credentials",
  })
  @ApiBadRequestResponse({
    description: "2FA not enabled or invalid input",
  })
  async verify2FA(
    @Body() dto: Verify2FALoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminAuthResponseDto> {
    const userAgent = req.headers["user-agent"];
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      "unknown";

    const result = await this.adminAuthService.verify2FAAndLogin(
      dto.email,
      dto.code,
      dto.deviceId,
      userAgent,
      ipAddress,
    );

    // Set httpOnly cookies
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ("strict" as const) : ("lax" as const), // Strict in production for CSRF protection
      path: "/",
    };

    res.cookie("admin_access_token", result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("admin_refresh_token", result.refreshToken, {
      ...cookieOptions,
      maxAge:
        parseInt(process.env.ADMIN_REFRESH_TOKEN_EXPIRY_DAYS || "90", 10) *
        24 *
        60 *
        60 *
        1000, // 90 days default
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      id: result.admin.id,
      email: result.admin.email,
      role: result.admin.role as
        | "admin"
        | "customer"
        | "support"
        | "reviewer"
        | "marketing",
      requires2fa: result.requires2fa,
    };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Refresh access token",
    description:
      "Get a new access token and refresh token using a valid refresh token. Implements refresh token rotation.",
  })
  @ApiOkResponse({
    description: "Tokens successfully refreshed",
    type: AdminAuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Invalid or expired refresh token",
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = req.cookies?.admin_refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token not found");
    }

    const tokens = await this.adminAuthService.refreshAccessToken(refreshToken);

    // Update cookies
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ("strict" as const) : ("lax" as const), // Strict in production for CSRF protection
      path: "/",
    };

    res.cookie("admin_access_token", tokens.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("admin_refresh_token", tokens.refreshToken, {
      ...cookieOptions,
      maxAge:
        parseInt(process.env.ADMIN_REFRESH_TOKEN_EXPIRY_DAYS || "90", 10) *
        24 *
        60 *
        60 *
        1000,
    });

    return tokens;
  }

  @Delete("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Logout (single device)",
    description: "Logout from current device and delete session",
  })
  @ApiOkResponse({
    description: "Successfully logged out",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async logout(
    @Req() req: Request & {
      user?: { sessionId?: string; id?: string; sub?: string };
    },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const sessionId = req.user?.sessionId;
    const adminId = req.user?.id || req.user?.sub;

    if (sessionId && adminId) {
      await this.adminAuthService.logout(sessionId, adminId);
    }

    // Clear cookies
    res.clearCookie("admin_access_token", { path: "/" });
    res.clearCookie("admin_refresh_token", { path: "/" });

    return { message: "Logged out successfully" };
  }

  @Delete("logout/all")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Logout all devices",
    description: "Logout from all devices and delete all sessions",
  })
  @ApiOkResponse({
    description: "Successfully logged out from all devices",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async logoutAll(
    @Req() req: Request & { user?: { id?: string; sub?: string } },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const adminId = req.user?.id || req.user?.sub;

    if (adminId) {
      await this.adminAuthService.logoutAll(adminId);
    }

    // Clear cookies
    res.clearCookie("admin_access_token", { path: "/" });
    res.clearCookie("admin_refresh_token", { path: "/" });

    return { message: "Logged out from all devices successfully" };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get current admin info",
    description:
      "Get admin information including active sessions count and 2FA status",
  })
  @ApiOkResponse({
    description: "Admin info retrieved successfully",
    type: AdminMeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async getMe(
    @Req() req: Request & { user?: { id?: string; sub?: string } },
  ): Promise<AdminMeResponseDto> {
    const adminId = req.user?.id || req.user?.sub;
    if (!adminId) {
      throw new UnauthorizedException("Admin ID not found");
    }

    const info = await this.adminAuthService.getAdminInfo(adminId);
    return {
      id: info.id,
      email: info.email,
      role: info.role as
        | "admin"
        | "customer"
        | "support"
        | "reviewer"
        | "marketing",
      roleId: info.roleId ?? undefined,
      activeSessionsCount: info.activeSessionsCount,
      twoFactorEnabled: info.has2fa,
    };
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "List active sessions",
    description: "Get all active sessions for the current admin",
  })
  @ApiOkResponse({
    description: "Active sessions retrieved successfully",
    type: AdminSessionsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async getSessions(
    @Req() req: Request & { user?: { id?: string; sub?: string } },
  ): Promise<AdminSessionsResponseDto> {
    const adminId = req.user?.id || req.user?.sub;
    if (!adminId) {
      throw new UnauthorizedException("Admin ID not found");
    }

    const sessions = await this.sessionsService.getActiveSessions(adminId);
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceId: s.deviceId,
        userAgent: s.userAgent ?? undefined,
        ipAddress: s.ipAddress ?? undefined,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        lastUsedAt: s.lastUsedAt,
      })),
    };
  }

  @Delete("sessions/:sessionId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Revoke a session",
    description: "Revoke a specific session by session ID",
  })
  @ApiOkResponse({
    description: "Session revoked successfully",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async revokeSession(
    @Param("sessionId") sessionId: string,
    @Req() req: Request & { user?: { id?: string; sub?: string } },
  ): Promise<{ message: string }> {
    const adminId = req.user?.id || req.user?.sub;
    if (!adminId) {
      throw new UnauthorizedException("Admin ID not found");
    }

    await this.sessionsService.deleteSession(sessionId);

    return { message: "Session revoked successfully" };
  }

  @Post("secret/rotate")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Manually rotate JWT secret",
    description:
      "Manually trigger JWT secret rotation. Only accessible to admins. Requires JWT_SECRET_ROTATION_ENABLED=true.",
  })
  @ApiOkResponse({
    description: "Secret rotated successfully",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        version: { type: "string" },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async rotateSecret(): Promise<{ message: string; version: string }> {
    const version = await this.secretRotationService.rotateSecret();
    return {
      message: "JWT secret rotated successfully",
      version,
    };
  }
}
