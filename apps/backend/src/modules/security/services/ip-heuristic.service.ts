import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { IpReputationService } from "./ip-reputation.service";

export interface RequestPattern {
  ipAddress: string;
  userAgent?: string;
  headers: Record<string, string | string[] | undefined>;
  timestamp: Date;
}

export interface AutomationDetectionResult {
  isAutomated: boolean;
  confidence: number; // 0-100
  factors: string[];
  score: number; // 0-100, higher = more likely automated
}

/**
 * IP Heuristic Service
 * Detects automation and bot patterns in requests
 */
@Injectable()
export class IpHeuristicService {
  constructor(
    private readonly ipReputationService: IpReputationService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Analyze request pattern for automation indicators
   */
  async detectAutomation(
    pattern: RequestPattern,
  ): Promise<AutomationDetectionResult> {
    const factors: string[] = [];
    let score = 0;

    try {
      // Factor 1: IP Reputation (0-40 points)
      const reputation = await this.ipReputationService.getReputation(
        pattern.ipAddress,
      );
      if (reputation.score > 50) {
        score += 40;
        factors.push("HIGH_REPUTATION_SCORE");
      } else if (reputation.score > 30) {
        score += 20;
        factors.push("MODERATE_REPUTATION_SCORE");
      }

      if (reputation.isVpn || reputation.isProxy || reputation.isTor) {
        score += 30;
        factors.push("VPN_PROXY_TOR");
      }

      if (reputation.isDatacenter) {
        score += 15;
        factors.push("DATACENTER_IP");
      }

      // Factor 2: User-Agent analysis (0-20 points)
      const uaScore = this.analyzeUserAgent(pattern.userAgent);
      score += uaScore.score;
      if (uaScore.factors.length > 0) {
        factors.push(...uaScore.factors);
      }

      // Factor 3: Header analysis (0-20 points)
      const headerScore = this.analyzeHeaders(pattern.headers);
      score += headerScore.score;
      if (headerScore.factors.length > 0) {
        factors.push(...headerScore.factors);
      }

      // Factor 4: Request timing patterns (0-10 points)
      // This would require tracking request history - simplified for now
      // In production, check Redis for request frequency patterns

      // Cap score at 100
      score = Math.min(score, 100);

      const isAutomated = score >= 50; // Threshold for automation detection
      const confidence = Math.min(score, 100);

      this.logger.debug(
        createLogContext(this.contextService, "detectAutomation", {
          ipAddress: pattern.ipAddress,
          score,
          factors,
          isAutomated,
        }),
        `Automation detection: ${isAutomated ? "AUTOMATED" : "HUMAN"} (score: ${score})`,
      );

      return {
        isAutomated,
        confidence,
        factors,
        score,
      };
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "detectAutomation", error, {
          ipAddress: pattern.ipAddress,
        }),
        "Failed to detect automation",
      );
      // Return low score on error to avoid blocking legitimate users
      return {
        isAutomated: false,
        confidence: 0,
        factors: [],
        score: 0,
      };
    }
  }

  /**
   * Analyze User-Agent header
   */
  private analyzeUserAgent(userAgent?: string): {
    score: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 0;

    if (!userAgent) {
      score += 20;
      factors.push("MISSING_USER_AGENT");
      return { score, factors };
    }

    // Check for bot patterns
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /go-http/i,
      /node-fetch/i,
      /axios/i,
      /postman/i,
      /insomnia/i,
      /httpie/i,
    ];

    if (botPatterns.some((pattern) => pattern.test(userAgent))) {
      score += 20;
      factors.push("BOT_USER_AGENT");
    }

    // Check for suspicious patterns
    if (userAgent.length < 10) {
      score += 15;
      factors.push("SHORT_USER_AGENT");
    }

    // Check for missing browser indicators
    const browserIndicators = [
      /mozilla/i,
      /chrome/i,
      /safari/i,
      /firefox/i,
      /edge/i,
      /opera/i,
    ];
    if (!browserIndicators.some((pattern) => pattern.test(userAgent))) {
      score += 10;
      factors.push("NO_BROWSER_INDICATORS");
    }

    return { score, factors };
  }

  /**
   * Analyze HTTP headers for automation indicators
   */
  private analyzeHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): {
    score: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 0;

    // Check for missing common browser headers
    const commonHeaders = ["accept", "accept-language", "accept-encoding"];
    const missingHeaders = commonHeaders.filter(
      (header) => !headers[header] && !headers[header.toLowerCase()],
    );

    if (missingHeaders.length > 0) {
      score += 10;
      factors.push(`MISSING_HEADERS:${missingHeaders.join(",")}`);
    }

    // Check Accept header
    const accept = headers.accept || headers.Accept;
    if (!accept || (typeof accept === "string" && accept.length < 10)) {
      score += 10;
      factors.push("SUSPICIOUS_ACCEPT_HEADER");
    }

    // Check Accept-Language header
    const acceptLanguage =
      headers["accept-language"] || headers["Accept-Language"];
    if (!acceptLanguage) {
      score += 5;
      factors.push("MISSING_ACCEPT_LANGUAGE");
    }

    // Check for suspicious header patterns
    const suspiciousHeaders = ["x-forwarded-for", "via", "x-real-ip"];
    const _hasSuspiciousHeaders = suspiciousHeaders.some(
      (header) => headers[header] || headers[header.toLowerCase()],
    );

    // Having these headers alone isn't suspicious (they're normal in proxied environments)
    // But combined with other factors, they can indicate automation

    return { score, factors };
  }
}
