import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { sql } from "@vcecom/db";
import { RedisHealthService } from "../../modules/admin/services/redis-health.service";
import { DB_TOKEN } from "../../modules/database/database.module";
import { DatabaseService } from "../../modules/database/database.service";
import type { Database } from "../../modules/database/db";
import { StorageService } from "../../modules/storage/storage.service";
import { AppConfigService } from "../config/app.config.service";
import { Public } from "../decorators/public.decorator";

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
  };
}

@ApiTags("admin")
@Controller("_health")
@Public()
export class HealthController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisHealthService: RedisHealthService,
    private readonly storageService: StorageService,
    private readonly appConfigService: AppConfigService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Comprehensive health check",
    description:
      "Returns health status for all critical services: database, Redis, and storage",
  })
  @ApiResponse({
    status: 200,
    description: "Health status for all services",
  })
  async getHealth(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const services: HealthCheckResult["services"] = {
      database: { status: "error" },
      redis: { status: "error" },
      storage: { status: "error" },
    };

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

    // Determine overall status
    const allOk =
      services.database.status === "ok" &&
      services.redis.status === "ok" &&
      services.storage.status === "ok";
    const anyError =
      services.database.status === "error" ||
      services.redis.status === "error" ||
      services.storage.status === "error";

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
