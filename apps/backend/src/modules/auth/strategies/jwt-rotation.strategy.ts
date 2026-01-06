import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { adminSessions, eq, users } from "@vcecom/db";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { getValidatedJwtSecret } from "../../../common/config/jwt-secret.validation";
import type { Database } from "../../../modules/database/db";
import { AdminSessionsService } from "../../admin-auth/admin-sessions.service";
import { SecretRotationService } from "../../admin-auth/services/secret-rotation.service";
import { DB_TOKEN } from "../../database/database.module";

/**
 * Custom JWT Strategy that supports secret rotation
 * Validates tokens using multiple secrets (current + grace period secrets)
 */
@Injectable()
export class JwtRotationStrategy extends PassportStrategy(
  Strategy,
  "jwt-rotation",
) {
  private validSecrets: string[] = [];

  constructor(
    private readonly adminSessionsService: AdminSessionsService,
    private readonly secretRotationService: SecretRotationService,
    @Inject(DB_TOKEN) private readonly db: Database,
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
      secretOrKeyProvider: async (request, rawJwtToken, done) => {
        // This will be called for each token validation
        // We'll handle multi-secret validation in validate() method
        const secrets = await this.getValidSecrets();
        // Return first secret as fallback, but we'll try all in validate()
        done(null, secrets[0] || getValidatedJwtSecret());
      },
    });
  }

  /**
   * Get all valid secrets for token validation
   */
  private async getValidSecrets(): Promise<string[]> {
    try {
      const secrets = await this.secretRotationService.getValidSecrets();
      if (secrets.length > 0) {
        this.validSecrets = secrets;
        return secrets;
      }
    } catch (_error) {
      // Fallback to environment secret if rotation service fails
    }

    // Fallback to environment secret
    const envSecret = getValidatedJwtSecret();
    if (!this.validSecrets.includes(envSecret)) {
      this.validSecrets = [envSecret];
    }
    return this.validSecrets;
  }

  /**
   * Validate JWT payload
   * Also validates session signature if session signing is enabled
   */
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

      // Validate session signature if signing is enabled
      const signingEnabled =
        process.env.ADMIN_SESSION_SIGNING_ENABLED === "true";
      if (signingEnabled && session.signature) {
        const isValid =
          await this.adminSessionsService.validateSessionSignature(
            session.id,
            session.signature,
          );
        if (!isValid) {
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
