import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction } from "express";
import { ContextService } from "../../common/logging/context.service";
import { ExtendedRequest, ExtendedResponse } from "../../common/logging/types";
import { GeoRulesService } from "./geo-rules.service";
import { GeolocationService } from "./geolocation.service";

/**
 * Middleware to detect geolocation and check geo rules
 * Runs after ContextMiddleware to have access to IP address
 */
@Injectable()
export class GeolocationMiddleware implements NestMiddleware {
  constructor(
    private readonly contextService: ContextService,
    private readonly geolocationService: GeolocationService,
    private readonly geoRulesService: GeoRulesService,
  ) {}

  async use(
    req: ExtendedRequest,
    res: ExtendedResponse,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Get IP from context (already extracted by ContextMiddleware)
      const ip = this.contextService.getValue("ip");

      if (ip && ip !== "unknown") {
        // Lookup geolocation
        const location = await this.geolocationService.lookupIp(ip);

        if (location) {
          // Store location in context
          this.contextService.setValue("location", location);

          // Check geo rules
          const ruleCheck = await this.geoRulesService.checkLocation(location);

          // Attach geo rule check result to request for use in controllers
          req.geoRuleCheck = ruleCheck;
        }
      }
    } catch (error) {
      // Log error but don't block request
      // Geolocation is non-critical functionality
      if (error instanceof Error) {
        // Silently fail - geolocation is optional
      }
    }

    next();
  }
}
