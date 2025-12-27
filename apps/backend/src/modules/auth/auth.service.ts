import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { eq, users } from "@vcecom/db";
import * as bcrypt from "bcrypt";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  async validateUser(email: string, password: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Regular auth users must have a password hash
    if (!user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return user;
  }

  async register(
    email: string,
    password: string,
    role: "admin" | "customer" = "customer",
  ) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException("Invalid email format");
    }

    // Check if user already exists
    const [existingUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      throw new BadRequestException("User with this email already exists");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const [newUser] = await this.db
      .insert(users)
      .values({
        email,
        passwordHash,
        role,
      })
      .returning();

    if (!newUser) {
      throw new BadRequestException("Failed to create user");
    }

    return this.login(newUser);
  }

  async login(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);

      // Verify user still exists
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);

      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      // Generate new tokens
      const newPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };
      const accessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
      });

      return {
        access_token: accessToken,
        refresh_token: newRefreshToken,
      };
    } catch (_error) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }
}
