import { Request, Response } from "express";
import type { Logger } from "pino";
import { RateLimitState } from "../rate-limiting/rate-limit.service";
import { RequestContext } from "./context.service";

export interface GeoRuleCheckResult {
  isRestricted: boolean;
  action: "BLOCK" | "WARN" | "REDIRECT" | null;
  warningMessage: string | null;
  redirectUrl: string | null;
  matchedRuleId: string | null;
}

/**
 * Extended Express Request with logger and user info
 */
export interface ExtendedRequest extends Request {
  logger?: Logger;
  user?: {
    id: string;
    email?: string;
    role?: string;
    customerId?: string;
  };
  rateLimitState?: RateLimitState;
  fingerprint?: string;
  geoRuleCheck?: GeoRuleCheckResult;
}

/**
 * Extended Express Response with request context
 */
export interface ExtendedResponse extends Response {
  requestContext?: RequestContext;
}

/**
 * Error response type
 */
export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  requestId: string;
  message?: string;
  error?: string;
  data?: unknown; // Structured error data (e.g., inventory failures)
}

/**
 * HttpException response type
 */
export interface HttpExceptionResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}
