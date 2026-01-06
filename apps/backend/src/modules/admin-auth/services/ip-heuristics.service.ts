import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, ipReputation, loginAttempts } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createErrorContext } from "../../../common/logging/logging.helper";
import type { Database } from "../../../modules/database/db";
import { DB_TOKEN } from "../../database/database.module";

export interface IpHeuristicResult {
  reputationScore: number; // 0-100, higher = more suspicious
  isDatacenter: boolean;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  riskFactors: string[];
  shouldBlock: boolean; // Block if score >= 80
  shouldChallenge: boolean; // Challenge if score >= 60
}

/**
 * IP Heuristics Service
 * Analyzes IP addresses for suspicious patterns and automation indicators
 */
@Injectable()
export class IpHeuristicsService {
  private readonly heuristicsEnabled: boolean;
  private readonly cacheTtlHours: number;

  // Suspicious user agent patterns
  private readonly botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java/i,
    /go-http/i,
    /^$/,
  ];

  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    this.heuristicsEnabled = process.env.IP_HEURISTICS_ENABLED === "true";
    this.cacheTtlHours = parseInt(
      process.env.IP_REPUTATION_CACHE_TTL_HOURS || "24",
      10,
    );
  }

  /**
   * Analyze IP address and return heuristic result
   */
  async analyzeIp(
    ipAddress: string,
    userAgent?: string,
    headers?: Record<string, string | string[] | undefined>,
  ): Promise<IpHeuristicResult> {
    if (!this.heuristicsEnabled || !ipAddress || ipAddress === "unknown") {
      return {
        reputationScore: 0,
        isDatacenter: false,
        isVpn: false,
        isProxy: false,
        isTor: false,
        riskFactors: [],
        shouldBlock: false,
        shouldChallenge: false,
      };
    }

    try {
      // Check cache first
      const cached = await this.getCachedReputation(ipAddress);
      if (cached) {
        return cached;
      }

      const riskFactors: string[] = [];
      let score = 0;

      // Factor 1: Request rate patterns (0-20 points)
      const ratePattern = await this.analyzeRequestRate(ipAddress);
      if (ratePattern.isSuspicious) {
        score += 20;
        riskFactors.push("SUSPICIOUS_REQUEST_RATE");
      }

      // Factor 2: User-Agent analysis (0-15 points)
      if (this.isSuspiciousUserAgent(userAgent)) {
        score += 15;
        riskFactors.push("SUSPICIOUS_USER_AGENT");
      }

      // Factor 3: Header analysis (0-15 points)
      if (this.hasMissingHeaders(headers)) {
        score += 15;
        riskFactors.push("MISSING_HEADERS");
      }

      // Factor 4: IP reputation from database (0-30 points)
      const reputation = await this.getIpReputation(ipAddress);
      if (reputation) {
        if (reputation.isDatacenter) {
          score += 20;
          riskFactors.push("DATACENTER_IP");
        }
        if (reputation.isVpn) {
          score += 25;
          riskFactors.push("VPN_IP");
        }
        if (reputation.isProxy) {
          score += 25;
          riskFactors.push("PROXY_IP");
        }
        if (reputation.isTor) {
          score += 30;
          riskFactors.push("TOR_IP");
        }
      }

      // Factor 5: Failed login patterns (0-20 points)
      const failedLoginPattern =
        await this.analyzeFailedLoginPattern(ipAddress);
      if (failedLoginPattern.isSuspicious) {
        score += 20;
        riskFactors.push("SYSTEMATIC_FAILED_LOGINS");
      }

      // Cap score at 100
      score = Math.min(score, 100);

      const result: IpHeuristicResult = {
        reputationScore: score,
        isDatacenter: reputation?.isDatacenter || false,
        isVpn: reputation?.isVpn || false,
        isProxy: reputation?.isProxy || false,
        isTor: reputation?.isTor || false,
        riskFactors,
        shouldBlock: score >= 80,
        shouldChallenge: score >= 60,
      };

      // Cache the result
      await this.cacheReputation(ipAddress, result, reputation);

      return result;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "analyzeIp", error, {
          ipAddress,
        }),
        "Failed to analyze IP address",
      );
      // Return low risk on error to avoid blocking legitimate users
      return {
        reputationScore: 0,
        isDatacenter: false,
        isVpn: false,
        isProxy: false,
        isTor: false,
        riskFactors: [],
        shouldBlock: false,
        shouldChallenge: false,
      };
    }
  }

  /**
   * Get cached IP reputation
   */
  private async getCachedReputation(
    ipAddress: string,
  ): Promise<IpHeuristicResult | null> {
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
        reputationScore: parseInt(cached.reputationScore, 10),
        isDatacenter: cached.isDatacenter,
        isVpn: cached.isVpn,
        isProxy: cached.isProxy,
        isTor: cached.isTor,
        riskFactors: (cached.riskFactors as string[]) || [],
        shouldBlock: parseInt(cached.reputationScore, 10) >= 80,
        shouldChallenge: parseInt(cached.reputationScore, 10) >= 60,
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
   * Cache IP reputation
   */
  private async cacheReputation(
    ipAddress: string,
    result: IpHeuristicResult,
    existingReputation?: {
      isDatacenter: boolean;
      isVpn: boolean;
      isProxy: boolean;
      isTor: boolean;
      country?: string | null;
      city?: string | null;
      asn?: string | null;
      organization?: string | null;
    } | null,
  ): Promise<void> {
    try {
      await this.db
        .insert(ipReputation)
        .values({
          ipAddress,
          reputationScore: result.reputationScore.toString(),
          isDatacenter: result.isDatacenter,
          isVpn: result.isVpn,
          isProxy: result.isProxy,
          isTor: result.isTor,
          riskFactors: result.riskFactors,
          country: existingReputation?.country || null,
          city: existingReputation?.city || null,
          asn: existingReputation?.asn || null,
          organization: existingReputation?.organization || null,
        })
        .onConflictDoUpdate({
          target: ipReputation.ipAddress,
          set: {
            reputationScore: result.reputationScore.toString(),
            isDatacenter: result.isDatacenter,
            isVpn: result.isVpn,
            isProxy: result.isProxy,
            isTor: result.isTor,
            riskFactors: result.riskFactors,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "cacheReputation", error),
        "Failed to cache IP reputation",
      );
    }
  }

  /**
   * Analyze request rate patterns
   */
  private async analyzeRequestRate(ipAddress: string): Promise<{
    isSuspicious: boolean;
  }> {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const attempts = await this.db
        .select()
        .from(loginAttempts)
        .where(
          and(
            eq(loginAttempts.ipAddress, ipAddress),
            gte(loginAttempts.createdAt, oneHourAgo),
          ),
        )
        .limit(100);

      // If too many requests with consistent timing, it's suspicious
      if (attempts.length > 50) {
        return { isSuspicious: true };
      }

      return { isSuspicious: false };
    } catch (_error) {
      return { isSuspicious: false };
    }
  }

  /**
   * Check if user agent is suspicious
   */
  private isSuspiciousUserAgent(userAgent?: string): boolean {
    if (!userAgent) {
      return true; // Missing user agent is suspicious
    }

    return this.botPatterns.some((pattern) => pattern.test(userAgent));
  }

  /**
   * Check for missing headers (indicates automation)
   */
  private hasMissingHeaders(
    headers?: Record<string, string | string[] | undefined>,
  ): boolean {
    if (!headers) {
      return true;
    }

    // Check for common browser headers
    const requiredHeaders = [
      "accept-language",
      "accept-encoding",
      "accept",
      "dnt", // Do Not Track
    ];

    const missingCount = requiredHeaders.filter(
      (header) => !headers[header] && !headers[header.toLowerCase()],
    ).length;

    // If more than 2 headers are missing, it's suspicious
    return missingCount > 2;
  }

  /**
   * Get IP reputation from database
   */
  private async getIpReputation(ipAddress: string): Promise<{
    isDatacenter: boolean;
    isVpn: boolean;
    isProxy: boolean;
    isTor: boolean;
    country?: string | null;
    city?: string | null;
    asn?: string | null;
    organization?: string | null;
  } | null> {
    try {
      const [reputation] = await this.db
        .select()
        .from(ipReputation)
        .where(eq(ipReputation.ipAddress, ipAddress))
        .limit(1);

      if (!reputation) {
        return null;
      }

      return {
        isDatacenter: reputation.isDatacenter,
        isVpn: reputation.isVpn,
        isProxy: reputation.isProxy,
        isTor: reputation.isTor,
        country: reputation.country,
        city: reputation.city,
        asn: reputation.asn,
        organization: reputation.organization,
      };
    } catch (_error) {
      return null;
    }
  }

  /**
   * Analyze failed login patterns
   */
  private async analyzeFailedLoginPattern(ipAddress: string): Promise<{
    isSuspicious: boolean;
  }> {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const failedAttempts = await this.db
        .select()
        .from(loginAttempts)
        .where(
          and(
            eq(loginAttempts.ipAddress, ipAddress),
            eq(loginAttempts.status, "FAILED"),
            gte(loginAttempts.createdAt, oneHourAgo),
          ),
        )
        .limit(20);

      // If more than 10 failed attempts in last hour, it's suspicious
      if (failedAttempts.length > 10) {
        return { isSuspicious: true };
      }

      return { isSuspicious: false };
    } catch (_error) {
      return { isSuspicious: false };
    }
  }
}
