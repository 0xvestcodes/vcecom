import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../logging/context.service";

/**
 * Security Headers Middleware
 * Adds comprehensive security headers to all responses
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: PinoLogger,
    readonly _contextService: ContextService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    try {
      // Strict-Transport-Security (HSTS)
      const hstsMaxAge = parseInt(process.env.HSTS_MAX_AGE || "31536000", 10); // 1 year default
      const hstsIncludeSubDomains =
        process.env.HSTS_INCLUDE_SUBDOMAINS !== "false";
      const hstsPreload = process.env.HSTS_PRELOAD === "true";

      let hstsValue = `max-age=${hstsMaxAge}`;
      if (hstsIncludeSubDomains) {
        hstsValue += "; includeSubDomains";
      }
      if (hstsPreload) {
        hstsValue += "; preload";
      }
      res.setHeader("Strict-Transport-Security", hstsValue);

      // X-Content-Type-Options
      res.setHeader("X-Content-Type-Options", "nosniff");

      // X-Frame-Options
      res.setHeader("X-Frame-Options", "DENY");

      // X-XSS-Protection
      res.setHeader("X-XSS-Protection", "1; mode=block");

      // Referrer-Policy
      res.setHeader(
        "Referrer-Policy",
        process.env.REFERRER_POLICY || "strict-origin-when-cross-origin",
      );

      // Permissions-Policy (formerly Feature-Policy)
      const permissionsPolicy = this.buildPermissionsPolicy();
      res.setHeader("Permissions-Policy", permissionsPolicy);

      // X-Permitted-Cross-Domain-Policies
      res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

      // Content-Security-Policy (enhanced)
      const csp = this.buildContentSecurityPolicy(req);
      if (csp) {
        res.setHeader("Content-Security-Policy", csp);
      }

      // Expect-CT (Certificate Transparency)
      if (process.env.EXPECT_CT_ENABLED === "true") {
        const expectCtMaxAge = parseInt(
          process.env.EXPECT_CT_MAX_AGE || "86400",
          10,
        ); // 1 day default
        res.setHeader("Expect-CT", `max-age=${expectCtMaxAge}, enforce`);
      }

      // X-DNS-Prefetch-Control
      res.setHeader("X-DNS-Prefetch-Control", "off");

      next();
    } catch (error) {
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to set security headers",
      );
      // Continue even if headers fail
      next();
    }
  }

  /**
   * Build Permissions-Policy header
   */
  private buildPermissionsPolicy(): string {
    const policies = [
      "accelerometer=()",
      "ambient-light-sensor=()",
      "autoplay=()",
      "battery=()",
      "camera=()",
      "cross-origin-isolated=()",
      "display-capture=()",
      "document-domain=()",
      "encrypted-media=()",
      "execution-while-not-rendered=()",
      "execution-while-out-of-viewport=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "keyboard-map=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "navigation-override=()",
      "payment=()",
      "picture-in-picture=()",
      "publickey-credentials-get=()",
      "screen-wake-lock=()",
      "sync-xhr=()",
      "usb=()",
      "web-share=()",
      "xr-spatial-tracking=()",
    ];

    return policies.join(", ");
  }

  /**
   * Build Content-Security-Policy header
   */
  private buildContentSecurityPolicy(req: Request): string | null {
    // Allow CSP to be configured via environment
    const cspEnabled = process.env.CSP_ENABLED !== "false";
    if (!cspEnabled) {
      return null;
    }

    const directives: string[] = [];

    // Default source
    directives.push("default-src 'self'");

    // Script sources
    const scriptSrc = process.env.CSP_SCRIPT_SRC || "'self'";
    directives.push(`script-src ${scriptSrc}`);

    // Style sources
    const styleSrc = process.env.CSP_STYLE_SRC || "'self' 'unsafe-inline'";
    directives.push(`style-src ${styleSrc}`);

    // Image sources
    const imgSrc = process.env.CSP_IMG_SRC || "'self' data: https:";
    directives.push(`img-src ${imgSrc}`);

    // Font sources
    const fontSrc = process.env.CSP_FONT_SRC || "'self' data:";
    directives.push(`font-src ${fontSrc}`);

    // Connect sources (for API calls)
    const connectSrc = process.env.CSP_CONNECT_SRC || "'self'";
    directives.push(`connect-src ${connectSrc}`);

    // Object sources
    directives.push("object-src 'none'");

    // Media sources
    const mediaSrc = process.env.CSP_MEDIA_SRC || "'self'";
    directives.push(`media-src ${mediaSrc}`);

    // Frame sources
    directives.push("frame-src 'none'");

    // Base URI
    directives.push("base-uri 'self'");

    // Form action
    directives.push("form-action 'self'");

    // Frame ancestors
    directives.push("frame-ancestors 'none'");

    // Upgrade insecure requests (in production)
    if (process.env.NODE_ENV === "production") {
      directives.push("upgrade-insecure-requests");
    }

    return directives.join("; ");
  }
}
