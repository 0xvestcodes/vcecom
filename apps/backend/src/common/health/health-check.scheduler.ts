import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Cron, SchedulerRegistry } from "@nestjs/schedule";
import { sql } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { RedisHealthService } from "../../modules/admin/services/redis-health.service";
import { DB_TOKEN } from "../../modules/database/database.module";
import { DatabaseService } from "../../modules/database/database.service";
import type { Database } from "../../modules/database/db";
import { StorageService } from "../../modules/storage/storage.service";
import { AppConfigService } from "../config/app.config.service";
import { ContextService } from "../logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../logging/logging.helper";

interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  services: {
    database: {
      status: "ok" | "error";
      pool?: {
        healthy: boolean;
        stats?: {
          totalConnections: number;
          usedConnections: number;
          idleConnections: number;
          waitingConnections: number;
          usagePercent: number;
          maxConnections: number;
        };
      };
      connectivity?: {
        status: string;
        queryLatency?: string;
      };
    };
    redis: {
      status: "ok" | "error" | "degraded";
      connection?: {
        status: string;
        latency?: number;
      };
      memory?: {
        used: number;
        peak: number;
        total: number;
        percentage: number;
      };
    };
    storage: {
      status: "ok" | "error";
      provider?: string;
      bucket?: string;
    };
    endpoints?: {
      status: "ok" | "error" | "degraded";
      checks?: Array<{
        url: string;
        status: "ok" | "error";
        statusCode?: number;
        responseTime?: number;
        error?: string;
      }>;
    };
  };
}

/**
 * Scheduler for continuous health checks
 * Performs health checks on database, Redis, and storage services at configurable intervals
 */
@Injectable()
export class HealthCheckScheduler implements OnModuleInit {
  private readonly cronExpression: string;
  private readonly enabled: boolean;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisHealthService: RedisHealthService,
    private readonly storageService: StorageService,
    private readonly appConfigService: AppConfigService,
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    // Get cron expression from environment variable, default to every 30 seconds
    this.cronExpression = process.env.HEALTH_CHECK_CRON || "*/30 * * * * *";
    // Check if health checks are enabled (default: true)
    this.enabled = process.env.HEALTH_CHECK_ENABLED !== "false";
  }

  /**
   * Check health endpoints by querying configured base URLs
   */
  private async checkHealthEndpoints(): Promise<{
    status: "ok" | "error" | "degraded";
    checks: Array<{
      url: string;
      status: "ok" | "error";
      statusCode?: number;
      responseTime?: number;
      error?: string;
    }>;
  }> {
    const baseUrls = process.env.HEALTH_CHECK_BASE_URLS;
    const endpoint = process.env.HEALTH_CHECK_ENDPOINT || "/_health";
    const timeout = parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || "5000", 10);

    // If no base URLs configured, skip endpoint checks
    if (!baseUrls || baseUrls.trim() === "") {
      return {
        status: "ok",
        checks: [],
      };
    }

    const urls = baseUrls
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      return {
        status: "ok",
        checks: [],
      };
    }

    const checks = await Promise.all(
      urls.map(async (baseUrl) => {
        const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;
        const startTime = Date.now();

        try {
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          try {
            const response = await fetch(url, {
              method: "GET",
              headers: {
                "User-Agent": "VCEcom-HealthCheck/1.0",
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;

            // Consider 2xx and 3xx as healthy
            const isHealthy = response.status >= 200 && response.status < 400;

            return {
              url,
              status: isHealthy ? ("ok" as const) : ("error" as const),
              statusCode: response.status,
              responseTime,
            };
          } catch (fetchError) {
            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;

            if (
              fetchError instanceof Error &&
              fetchError.name === "AbortError"
            ) {
              return {
                url,
                status: "error" as const,
                responseTime,
                error: `Request timed out after ${timeout}ms`,
              };
            }

            return {
              url,
              status: "error" as const,
              responseTime,
              error:
                fetchError instanceof Error
                  ? fetchError.message
                  : String(fetchError),
            };
          }
        } catch (error) {
          const responseTime = Date.now() - startTime;
          return {
            url,
            status: "error" as const,
            responseTime,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    // Determine overall status
    const allOk = checks.every((check) => check.status === "ok");
    const anyError = checks.some((check) => check.status === "error");

    const status: "ok" | "error" | "degraded" = allOk
      ? "ok"
      : anyError
        ? "error"
        : "degraded";

    return {
      status,
      checks,
    };
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.info(
        createLogContext(this.contextService, "healthCheckScheduler", {}),
        "Health check scheduler is disabled",
      );
      // Stop the default cron job if disabled
      try {
        const cronJob = this.schedulerRegistry.getCronJob("health-check");
        cronJob.stop();
      } catch {
        // Job doesn't exist yet, ignore
      }
      return;
    }

    this.logger.info(
      createLogContext(this.contextService, "healthCheckScheduler", {
        cronExpression: this.cronExpression,
        enabled: this.enabled,
      }),
      `Health check scheduler initialized with cron: ${this.cronExpression}`,
    );
  }

  /**
   * Perform health check - runs at configured interval (default: every 30 seconds)
   */
  @Cron("*/30 * * * * *", {
    name: "health-check",
  })
  async performHealthCheck(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const healthResult = await this.checkHealth();

      // Log detailed health check results
      const logContext = createLogContext(this.contextService, "healthCheck", {
        status: healthResult.status,
        timestamp: healthResult.timestamp,
        services: healthResult.services,
      });

      if (healthResult.status === "ok") {
        this.logger.info(
          logContext,
          "Health check passed - all services healthy",
        );
      } else if (healthResult.status === "degraded") {
        this.logger.warn(logContext, "Health check - some services degraded");
      } else {
        this.logger.error(
          logContext,
          "Health check failed - critical services unhealthy",
        );
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "healthCheck", error),
        "Health check execution failed",
      );
    }
  }

  /**
   * Perform comprehensive health check
   * Reuses logic from HealthController.getHealth()
   */
  private async checkHealth(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const services: HealthCheckResult["services"] = {
      database: { status: "error" },
      redis: { status: "error" },
      storage: { status: "error" },
    };

    // Check health endpoints (runs in parallel with other checks)
    const endpointCheckPromise = this.checkHealthEndpoints();

    // Check database
    try {
      const dbHealthStatus = this.databaseService.getHealthStatus();
      let connectivityStatus = "UNKNOWN";
      let queryLatency: number | null = null;

      if (dbHealthStatus.healthy) {
        try {
          const startTime = Date.now();
          await this.db.execute(sql`SELECT 1`);
          queryLatency = Date.now() - startTime;
          connectivityStatus = "OK";
        } catch (_error) {
          connectivityStatus = "ERROR";
        }
      } else {
        connectivityStatus = "POOL_NOT_HEALTHY";
      }

      services.database = {
        status:
          dbHealthStatus.healthy && connectivityStatus === "OK"
            ? "ok"
            : "error",
        pool: {
          healthy: dbHealthStatus.healthy,
          stats: dbHealthStatus.stats
            ? {
                totalConnections: dbHealthStatus.stats.totalCount,
                usedConnections: dbHealthStatus.stats.usedCount,
                idleConnections: dbHealthStatus.stats.idleCount,
                waitingConnections: dbHealthStatus.stats.waitingCount,
                usagePercent: dbHealthStatus.stats.usagePercent,
                maxConnections: dbHealthStatus.stats.maxConnections,
              }
            : undefined,
        },
        connectivity: {
          status: connectivityStatus,
          queryLatency: queryLatency ? `${queryLatency}ms` : undefined,
        },
      };
    } catch (_error) {
      services.database = {
        status: "error",
      };
    }

    // Check Redis
    try {
      const redisHealth = await this.redisHealthService.getHealth();
      services.redis = {
        status:
          redisHealth.status === "healthy"
            ? "ok"
            : redisHealth.status === "degraded"
              ? "degraded"
              : "error",
        connection: {
          status: redisHealth.connection.status,
          latency: redisHealth.connection.latency,
        },
        memory: {
          used: redisHealth.memory.used,
          peak: redisHealth.memory.peak,
          total: redisHealth.memory.total,
          percentage: redisHealth.memory.percentage,
        },
      };
    } catch (_error) {
      services.redis = {
        status: "error",
      };
    }

    // Check storage
    try {
      const storageProvider = this.storageService.getProviderType();
      const bucket = this.appConfigService.getStorageBucket();
      // Try to list files to verify storage is accessible
      try {
        await this.storageService.list("", 1); // List 1 file as a connectivity test
        services.storage = {
          status: "ok",
          provider: storageProvider,
          bucket,
        };
      } catch (_error) {
        services.storage = {
          status: "error",
          provider: storageProvider,
          bucket,
        };
      }
    } catch (_error) {
      services.storage = {
        status: "error",
      };
    }

    // Check health endpoints
    try {
      const endpointCheck = await endpointCheckPromise;
      if (endpointCheck.checks.length > 0) {
        services.endpoints = {
          status: endpointCheck.status,
          checks: endpointCheck.checks,
        };
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "checkHealthEndpoints", error),
        "Failed to check health endpoints",
      );
      services.endpoints = {
        status: "error",
        checks: [],
      };
    }

    // Determine overall status
    const allOk =
      services.database.status === "ok" &&
      services.redis.status === "ok" &&
      services.storage.status === "ok" &&
      (!services.endpoints || services.endpoints.status === "ok");
    const anyError =
      services.database.status === "error" ||
      services.redis.status === "error" ||
      services.storage.status === "error" ||
      (services.endpoints && services.endpoints.status === "error");

    const overallStatus: "ok" | "degraded" | "error" = allOk
      ? "ok"
      : anyError
        ? "error"
        : "degraded";

    return {
      status: overallStatus,
      timestamp,
      services,
    };
  }
}
