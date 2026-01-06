import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { adminSessions, eq, users } from "@vcecom/db";
import { Request } from "express";
import * as jwt from "jsonwebtoken";
import { ExtractJwt, Strategy } from "passport-jwt";
import { getValidatedJwtSecret } from "../../../common/config/jwt-secret.validation";
import type { Database } from "../../../modules/database/db";
import { AdminSessionsService } from "../../admin-auth/admin-sessions.service";
import { SecretRotationService } from "../../admin-auth/services/secret-rotation.service";
import { SessionSigningService } from "../../admin-auth/services/session-signing.service";
import { DB_TOKEN } from "../../database/database.module";

/**
 * Custom JWT Strategy that supports secret rotation
 * Validates tokens using multiple secrets (current + grace period secrets)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly adminSessionsService: AdminSessionsService,
    private readonly secretRotationService: SecretRotationService,
    private readonly sessionSigningService: SessionSigningService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Extract from cookie first
        (request: Request) => {
          return request?.cookies?.admin_access_token || null;
        },
        // Fallback to Authorization header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: getValidatedJwtSecret(), // Default secret for initialization
      // Use custom verification to try multiple secrets
      verify: async (
        payload: unknown,
        done: (error: Error | null, user?: unknown) => void,
      ) => {
        // Token was verified with default secret, pass payload to validate()
        done(null, payload);
      },
    });
  }

  /**
   * Override authenticate to support multiple secrets for token verification
   */
  async authenticate(req: Request): Promise<void> {
    const extractors = [
      (request: Request) => request?.cookies?.admin_access_token || null,
      ExtractJwt.fromAuthHeaderAsBearerToken(),
    ];

    let token: string | null = null;
    for (const extractor of extractors) {
      token = extractor(req);
      if (token) break;
    }

    if (!token) {
      return this.fail(new UnauthorizedException("No token provided"), 401);
    }

    // Try to verify with all valid secrets
    try {
      const validSecrets = await this.secretRotationService.getValidSecrets();
      let payload: unknown = null;
      let lastError: Error | null = null;

      for (const secret of validSecrets) {
        try {
          payload = jwt.verify(token, secret);
          break; // Success, exit loop
        } catch (error) {
          lastError = error as Error;
          // Continue to next secret
        }
      }

      if (!payload) {
        return this.fail(
          lastError || new UnauthorizedException("Invalid token"),
          401,
        );
      }

      // Validate payload and get user
      // Type guard to ensure payload has required properties
      if (
        typeof payload === "object" &&
        payload !== null &&
        "sub" in payload &&
        "email" in payload &&
        "role" in payload
      ) {
        const user = await this.validate(
          payload as {
            sub: string;
            email: string;
            role: string;
            sessionId?: string;
            deviceId?: string;
          },
        );
        if (!user) {
          return this.fail(new UnauthorizedException("Invalid user"), 401);
        }

        return this.success(user);
      }

      return this.fail(new UnauthorizedException("Invalid token payload"), 401);
    } catch (error) {
      return this.fail(
        error instanceof Error
          ? error
          : new UnauthorizedException("Authentication failed"),
        401,
      );
    }
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    sessionId?: string;
    deviceId?: string;
  }) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException();
    }

    // If it's an admin, validate the session
    if (user.role !== "customer" && payload.sessionId) {
      const [session] = await this.db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.id, payload.sessionId))
        .limit(1);

      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedException("Admin session invalid or expired");
      }

      // Validate session signature if present
      if (session.signature) {
        const isValidSignature = this.sessionSigningService.validateSignature(
          session.id,
          session.adminId,
          session.deviceId || "",
          session.createdAt,
          session.signature,
        );

        if (!isValidSignature) {
          // Signature mismatch - possible tampering
          // Invalidate the session
          await this.adminSessionsService.deleteSession(session.id);
          throw new UnauthorizedException(
            "Admin session signature validation failed",
          );
        }
      }

      // Update lastUsedAt for the session
      await this.adminSessionsService.updateLastUsedAt(payload.sessionId);

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        sessionId: payload.sessionId,
        deviceId: payload.deviceId,
      };
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
