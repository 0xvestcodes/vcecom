import * as fs from "node:fs";
import * as path from "node:path";
import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { geoLocationCache } from "@vcecom/db";
import { and, eq, gt, sql } from "drizzle-orm";
import { AppConfigService } from "../../common/config/app.config.service";
import { DB_TOKEN } from "../database/database.constants";
import type { Database } from "../database/db";
import { GeoLocationDto } from "./dto/geo-location.dto";

/**
 * MaxMind GeoIP2 location data interface
 */
interface MaxMindLocation {
  country?: { names?: { en?: string }; iso_code?: string } | null;
  subdivisions?: Array<{
    names?: { en?: string };
    iso_code?: string;
  }> | null;
  city?: { names?: { en?: string } } | null;
  postal?: { code?: string } | null;
  location?: {
    latitude?: number;
    longitude?: number;
    time_zone?: string;
  } | null;
  traits?: { isp?: string } | null;
}

@Injectable()
export class GeolocationService implements OnModuleInit {
  private readonly logger = new Logger(GeolocationService.name);
  private maxMindReader: Awaited<
    ReturnType<typeof import("@maxmind/geoip2-node").Reader.openBuffer>
  > | null = null;
  private readonly databasePath: string;
  private readonly cacheTtl: number;

  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    readonly _configService: AppConfigService,
  ) {
    this.databasePath =
      process.env.MAXMIND_DATABASE_PATH || "./data/GeoLite2-City.mmdb";
    this.cacheTtl = process.env.GEO_LOCATION_CACHE_TTL
      ? parseInt(process.env.GEO_LOCATION_CACHE_TTL, 10)
      : 604800; // 7 days default
  }

  async onModuleInit() {
    await this.initializeMaxMind();
  }

  /**
   * Initialize MaxMind GeoIP2 reader
   */
  private async initializeMaxMind() {
    try {
      // Dynamic import to avoid requiring @maxmind/geoip2-node if not installed
      const { Reader } = await import("@maxmind/geoip2-node");
      const fullPath = path.resolve(this.databasePath);

      if (!fs.existsSync(fullPath)) {
        this.logger.warn(
          `MaxMind database not found at ${fullPath}. Geolocation will be disabled.`,
        );
        return;
      }

      const buffer = fs.readFileSync(fullPath);
      this.maxMindReader = Reader.openBuffer(buffer);
      this.logger.log(`MaxMind GeoIP2 database loaded from ${fullPath}`);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Cannot find module")
      ) {
        this.logger.warn(
          "@maxmind/geoip2-node not installed. Install it to enable geolocation.",
        );
      } else {
        this.logger.error(
          `Failed to initialize MaxMind: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  }

  /**
   * Lookup IP address and return location data
   * Uses cache first, then MaxMind, then stores in cache
   */
  async lookupIp(ipAddress: string): Promise<GeoLocationDto | null> {
    if (!ipAddress || ipAddress === "unknown" || ipAddress === "::1") {
      return null;
    }

    // Check cache first
    const cached = await this.getCachedLocation(ipAddress);
    if (cached) {
      return cached;
    }

    // Lookup from MaxMind
    const location = await this.lookupFromMaxMind(ipAddress);
    if (!location) {
      return null;
    }

    // Store in cache
    await this.cacheLocation(ipAddress, location);

    return location;
  }

  /**
   * Get cached location from database
   */
  private async getCachedLocation(
    ipAddress: string,
  ): Promise<GeoLocationDto | null> {
    try {
      const [cached] = await this.db
        .select()
        .from(geoLocationCache)
        .where(
          and(
            eq(geoLocationCache.ipAddress, ipAddress),
            gt(geoLocationCache.expiresAt, sql`NOW()`),
          ),
        )
        .limit(1);

      if (!cached) {
        return null;
      }

      return {
        ipAddress: cached.ipAddress,
        country: cached.country || null,
        countryCode: cached.countryCode || null,
        region: cached.region || null,
        regionCode: cached.regionCode || null,
        city: cached.city || null,
        postalCode: cached.postalCode || null,
        latitude: cached.latitude || null,
        longitude: cached.longitude || null,
        timezone: cached.timezone || null,
        isp: cached.isp || null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get cached location: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return null;
    }
  }

  /**
   * Lookup location from MaxMind database
   */
  private async lookupFromMaxMind(
    ipAddress: string,
  ): Promise<GeoLocationDto | null> {
    if (!this.maxMindReader) {
      return null;
    }

    try {
      const response = this.maxMindReader.city(ipAddress) as MaxMindLocation;

      return {
        ipAddress,
        country: response.country?.names?.en || null,
        countryCode: response.country?.iso_code || null,
        region:
          response.subdivisions?.[0]?.names?.en ||
          response.subdivisions?.[0]?.iso_code ||
          null,
        regionCode: response.subdivisions?.[0]?.iso_code || null,
        city: response.city?.names?.en || null,
        postalCode: response.postal?.code || null,
        latitude: response.location?.latitude || null,
        longitude: response.location?.longitude || null,
        timezone: response.location?.time_zone || null,
        isp: response.traits?.isp || null,
      };
    } catch (error) {
      // MaxMind throws errors for invalid IPs or missing data
      this.logger.debug(
        `MaxMind lookup failed for ${ipAddress}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return null;
    }
  }

  /**
   * Cache location in database
   */
  private async cacheLocation(
    ipAddress: string,
    location: GeoLocationDto,
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + this.cacheTtl);

      await this.db.insert(geoLocationCache).values({
        ipAddress,
        country: location.country || null,
        countryCode: location.countryCode || null,
        region: location.region || null,
        regionCode: location.regionCode || null,
        city: location.city || null,
        postalCode: location.postalCode || null,
        latitude: location.latitude || null,
        longitude: location.longitude || null,
        timezone: location.timezone || null,
        isp: location.isp || null,
        expiresAt,
      });
    } catch (error) {
      // Ignore cache errors (e.g., duplicate key)
      this.logger.debug(
        `Failed to cache location: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache(): Promise<void> {
    try {
      await this.db
        .delete(geoLocationCache)
        .where(sql`${geoLocationCache.expiresAt} < NOW()`);
    } catch (error) {
      this.logger.error(
        `Failed to cleanup expired cache: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
