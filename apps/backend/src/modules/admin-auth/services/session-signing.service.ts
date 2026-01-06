import { createHmac } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import { SecretRotationService } from "./secret-rotation.service";

/**
 * Service for generating and validating HMAC signatures for admin sessions
 */
@Injectable()
export class SessionSigningService {
  constructor(
    private readonly secretRotationService: SecretRotationService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Generate HMAC signature for admin session
   * Signature: HMAC-SHA256(sessionId + adminId + deviceId + createdAt + secret)
   */
  async generateSignature(
    sessionId: string,
    adminId: string,
    deviceId: string,
    createdAt: Date,
  ): Promise<string> {
    try {
      const secret = await this.secretRotationService.getCurrentSecret();
      const payload = `${sessionId}:${adminId}:${deviceId}:${createdAt.toISOString()}`;
      const hmac = createHmac("sha256", secret);
      hmac.update(payload);
      return hmac.digest("hex");
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "generateSignature", error),
        "Failed to generate session signature",
      );
      throw error;
    }
  }

  /**
   * Validate session signature
   * Regenerates signature and compares with stored signature
   */
  async validateSignature(
    sessionId: string,
    adminId: string,
    deviceId: string,
    createdAt: Date,
    storedSignature: string,
  ): Promise<boolean> {
    try {
      // Regenerate signature
      const expectedSignature = await this.generateSignature(
        sessionId,
        adminId,
        deviceId,
        createdAt,
      );

      // Compare signatures using constant-time comparison
      return this.constantTimeCompare(storedSignature, expectedSignature);
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "validateSignature", error),
        "Failed to validate session signature",
      );
      return false;
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
