import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as jwt from "jsonwebtoken";
import { SecretRotationService } from "../../admin-auth/services/secret-rotation.service";

/**
 * JWT Service wrapper that supports secret rotation
 * Uses current secret for signing, validates with all valid secrets
 */
@Injectable()
export class JwtRotationService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly secretRotationService: SecretRotationService,
  ) {}

  /**
   * Sign a JWT token using the current active secret
   */
  async sign(
    payload: string | object | Buffer,
    options?: jwt.SignOptions,
  ): Promise<string> {
    const currentSecret = await this.secretRotationService.getCurrentSecret();

    // Use jsonwebtoken directly with the current secret
    const expiresIn =
      options?.expiresIn || process.env.ADMIN_ACCESS_TOKEN_EXPIRES_IN || "15m";
    const signOptions: jwt.SignOptions = {
      ...options,
    };
    if (expiresIn) {
      // StringValue is a type from jsonwebtoken that accepts string durations like "15m"
      signOptions.expiresIn = expiresIn as jwt.SignOptions["expiresIn"];
    }
    return jwt.sign(payload, currentSecret, signOptions);
  }

  /**
   * Verify a JWT token using all valid secrets (current + grace period)
   */
  async verify<T = unknown>(
    token: string,
    options?: jwt.VerifyOptions,
  ): Promise<T> {
    const validSecrets = await this.secretRotationService.getValidSecrets();

    // Try each secret until one works
    let lastError: Error | null = null;
    for (const secret of validSecrets) {
      try {
        return jwt.verify(token, secret, options) as T;
      } catch (error) {
        lastError = error as Error;
        // Continue to next secret
      }
    }

    // If all secrets failed, throw the last error
    throw lastError || new Error("Token verification failed");
  }

  /**
   * Decode a JWT token without verification
   */
  decode<T = unknown>(token: string, options?: jwt.DecodeOptions): T | null {
    return this.jwtService.decode(token, options) as T | null;
  }
}
