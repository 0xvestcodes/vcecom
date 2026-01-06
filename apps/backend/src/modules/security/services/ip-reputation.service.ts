import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, ipReputation } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import type { Database } from "../../../modules/database/db";
import { DB_TOKEN } from "../../database/database.module";

export interface IpReputationResult {
  score: number; // 0-100, higher = more suspicious
  isDatacenter: boolean;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  country?: string;
  city?: string;
  asn?: string;
  organization?: string;
  riskFactors: string[];
  cached: boolean;
}

/**
 * IP Reputation Service
 * Analyzes IP addresses for reputation and risk factors
 * Caches results in database for performance
 */
@Injectable()
export class IpReputationService {
  private readonly cacheTtlHours: number;
  private readonly enabled: boolean;

  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    this.enabled = process.env.IP_REPUTATION_ENABLED !== "false";
    this.cacheTtlHours = parseInt(
      process.env.IP_REPUTATION_CACHE_TTL_HOURS || "24",
      10,
    );
  }

  /**
   * Get IP reputation score and analysis
   */
  async getReputation(ipAddress: string): Promise<IpReputationResult> {
    if (!this.enabled) {
      return this.getDefaultResult(false);
    }

    if (!ipAddress || ipAddress === "unknown" || ipAddress === "::1") {
      return this.getDefaultResult(false);
    }

    try {
      // Check cache first
      const cached = await this.getCachedReputation(ipAddress);
      if (cached) {
        return {
          ...cached,
          cached: true,
        };
      }

      // Analyze IP (fallback to heuristics if API unavailable)
      const result = await this.analyzeIp(ipAddress);

      // Cache the result
      await this.cacheReputation(ipAddress, result);

      return {
        ...result,
        cached: false,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "getReputation", error, {
          ipAddress,
        }),
        "Failed to get IP reputation",
      );
      // Return default (low risk) on error to avoid blocking legitimate users
      return this.getDefaultResult(false);
    }
  }

  /**
   * Check if IP should be blocked based on reputation
   */
  async shouldBlockIp(ipAddress: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    const threshold = parseInt(
      process.env.IP_REPUTATION_BLOCK_THRESHOLD || "70",
      10,
    );

    const reputation = await this.getReputation(ipAddress);
    return reputation.score >= threshold;
  }

  /**
   * Get cached reputation from database
   */
  private async getCachedReputation(
    ipAddress: string,
  ): Promise<IpReputationResult | null> {
    try {
      const cacheExpiry = new Date();
      cacheExpiry.setHours(cacheExpiry.getHours() - this.cacheTtlHours);

      const [cached] = await this.db
        .select()
        .from(ipReputation)
        .where(
          and(
            eq(ipReputation.ipAddress, ipAddress),
            gte(ipReputation.updatedAt, cacheExpiry),
          ),
        )
        .limit(1);

      if (!cached) {
        return null;
      }

      return {
        score: parseInt(cached.reputationScore, 10),
        isDatacenter: cached.isDatacenter,
        isVpn: cached.isVpn,
        isProxy: cached.isProxy,
        isTor: cached.isTor,
        country: cached.country || undefined,
        city: cached.city || undefined,
        asn: cached.asn || undefined,
        organization: cached.organization || undefined,
        riskFactors: (cached.riskFactors as string[]) || [],
        cached: true,
      };
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "getCachedReputation", error),
        "Failed to get cached reputation",
      );
      return null;
    }
  }

  /**
   * Cache reputation result in database
   */
  private async cacheReputation(
    ipAddress: string,
    result: Omit<IpReputationResult, "cached">,
  ): Promise<void> {
    try {
      await this.db
        .insert(ipReputation)
        .values({
          ipAddress,
          reputationScore: result.score.toString(),
          isDatacenter: result.isDatacenter,
          isVpn: result.isVpn,
          isProxy: result.isProxy,
          isTor: result.isTor,
          country: result.country || null,
          city: result.city || null,
          asn: result.asn || null,
          organization: result.organization || null,
          riskFactors: result.riskFactors,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: ipReputation.ipAddress,
          set: {
            reputationScore: result.score.toString(),
            isDatacenter: result.isDatacenter,
            isVpn: result.isVpn,
            isProxy: result.isProxy,
            isTor: result.isTor,
            country: result.country || null,
            city: result.city || null,
            asn: result.asn || null,
            organization: result.organization || null,
            riskFactors: result.riskFactors,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "cacheReputation", error),
        "Failed to cache reputation",
      );
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  /**
   * Analyze IP address using heuristics and optional external APIs
   */
  private async analyzeIp(
    ipAddress: string,
  ): Promise<Omit<IpReputationResult, "cached">> {
    const riskFactors: string[] = [];
    let score = 0;

    // Check if IP is localhost or private
    if (this.isPrivateIp(ipAddress)) {
      return this.getDefaultResult(false);
    }

    // Heuristic checks (can be enhanced with external APIs)
    // Check 1: Known datacenter IP ranges (simplified)
    const isDatacenter = this.isDatacenterIp(ipAddress);
    if (isDatacenter) {
      score += 20;
      riskFactors.push("DATACENTER_IP");
    }

    // Check 2: Known VPN/Proxy patterns (simplified)
    // In production, use external APIs like AbuseIPDB, IPQualityScore, or MaxMind
    const isVpn = false; // Would be set by external API
    const isProxy = false; // Would be set by external API
    const isTor = false; // Would be set by external API

    if (isVpn) {
      score += 25;
      riskFactors.push("VPN");
    }
    if (isProxy) {
      score += 30;
      riskFactors.push("PROXY");
    }
    if (isTor) {
      score += 40;
      riskFactors.push("TOR");
    }

    // Check 3: IP format patterns (suspicious patterns)
    if (this.hasSuspiciousPattern(ipAddress)) {
      score += 15;
      riskFactors.push("SUSPICIOUS_PATTERN");
    }

    // Cap score at 100
    score = Math.min(score, 100);

    return {
      score,
      isDatacenter,
      isVpn,
      isProxy,
      isTor,
      riskFactors,
    };
  }

  /**
   * Check if IP is private/localhost
   */
  private isPrivateIp(ipAddress: string): boolean {
    return (
      ipAddress === "127.0.0.1" ||
      ipAddress === "::1" ||
      ipAddress.startsWith("192.168.") ||
      ipAddress.startsWith("10.") ||
      ipAddress.startsWith("172.16.") ||
      ipAddress.startsWith("172.17.") ||
      ipAddress.startsWith("172.18.") ||
      ipAddress.startsWith("172.19.") ||
      ipAddress.startsWith("172.20.") ||
      ipAddress.startsWith("172.21.") ||
      ipAddress.startsWith("172.22.") ||
      ipAddress.startsWith("172.23.") ||
      ipAddress.startsWith("172.24.") ||
      ipAddress.startsWith("172.25.") ||
      ipAddress.startsWith("172.26.") ||
      ipAddress.startsWith("172.27.") ||
      ipAddress.startsWith("172.28.") ||
      ipAddress.startsWith("172.29.") ||
      ipAddress.startsWith("172.30.") ||
      ipAddress.startsWith("172.31.") ||
      ipAddress.startsWith("fc00:") ||
      ipAddress.startsWith("fe80:")
    );
  }

  /**
   * Check if IP is likely a datacenter IP
   * Simplified check - in production, use IP geolocation databases
   */
  private isDatacenterIp(ipAddress: string): boolean {
    // This is a simplified check
    // In production, use MaxMind GeoIP2 or similar service
    // Common datacenter ASNs: AWS, Google Cloud, Azure, etc.
    return false; // Would be determined by external API
  }

  /**
   * Check for suspicious IP patterns
   */
  private hasSuspiciousPattern(ipAddress: string): boolean {
    // Check for patterns that might indicate automated access
    // This is very basic - in production, use more sophisticated analysis
    return false;
  }

  /**
   * Get default (low risk) result
   */
  private getDefaultResult(cached: boolean): IpReputationResult {
    return {
      score: 0,
      isDatacenter: false,
      isVpn: false,
      isProxy: false,
      isTor: false,
      riskFactors: [],
      cached,
    };
  }
}
