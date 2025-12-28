import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction } from "express";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../logging/context.service";
import { ExtendedRequest, ExtendedResponse } from "../logging/types";
import {
  extractFingerprintComponents,
  generateDeviceFingerprint,
} from "../utils/fingerprint.utils";

/**
 * Middleware to generate and attach device fingerprint to request context
 * Used for abuse prevention (limiting active reservations per device)
 */
@Injectable()
export class FingerprintMiddleware implements NestMiddleware {
  constructor(
    private readonly contextService: ContextService,
    private readonly logger: PinoLogger,
  ) {}

  use(req: ExtendedRequest, res: ExtendedResponse, next: NextFunction): void {
    try {
      // Get IP from context (already extracted by ContextMiddleware)
      const ip = this.contextService.getValue("ip") || "unknown";

      // Extract fingerprint components from headers
      const headers = req.headers as Record<
        string,
        string | string[] | undefined
      >;
      const { userAgent, accept } = extractFingerprintComponents(headers, ip);

      // Generate device fingerprint
      const fingerprint = generateDeviceFingerprint(userAgent, ip, accept);

      // Attach fingerprint to request context
      this.contextService.setValue("fingerprint", fingerprint);

      // Attach to request object for easy access
      req.fingerprint = fingerprint;

      next();
    } catch (error) {
      // Log error but don't block request
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to generate device fingerprint",
      );
      // Continue without fingerprint (fallback behavior)
      next();
    }
  }
}
