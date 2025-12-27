import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { adminSessions, eq, users } from "@vcecom/db";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Database } from "../../../modules/database/db";
import { AdminSessionsService } from "../../admin-auth/admin-sessions.service";
import { DB_TOKEN } from "../../database/database.module";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly adminSessionsService: AdminSessionsService,
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
      secretOrKey: process.env.JWT_SECRET || "change-me-in-production",
    });
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
      const session = await this.db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.id, payload.sessionId))
        .limit(1);

      if (
        !session ||
        session.length === 0 ||
        session[0].expiresAt < new Date()
      ) {
        throw new UnauthorizedException("Admin session invalid or expired");
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
