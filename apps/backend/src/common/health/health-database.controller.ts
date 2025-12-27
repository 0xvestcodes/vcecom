import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { sql } from "@vcecom/db";
import { DB_TOKEN } from "../../modules/database/database.module";
import { DatabaseService } from "../../modules/database/database.service";
import type { Database } from "../../modules/database/db";
import { Public } from "../decorators/public.decorator";

@ApiTags("admin")
@Controller("_health")
@Public()
export class HealthDatabaseController {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  @Get("database")
  @ApiOperation({
    summary: "Database health check",
    description:
      "Returns database connection pool status and connectivity test",
  })
  @ApiResponse({
    status: 200,
    description: "Database health status",
  })
  async getDatabaseHealth() {
    const healthStatus = this.databaseService.getHealthStatus();
    let connectivityStatus = "UNKNOWN";
    let queryLatency: number | null = null;

    // Test database connectivity with a simple query
    if (healthStatus.healthy) {
      try {
        const startTime = Date.now();
        await this.db.execute(sql`SELECT 1`); // Use injected db instance
        queryLatency = Date.now() - startTime;
        connectivityStatus = "OK";
      } catch (_error) {
        connectivityStatus = "ERROR";
      }
    } else {
      connectivityStatus = "POOL_NOT_HEALTHY";
    }

    return {
      status:
        healthStatus.healthy && connectivityStatus === "OK" ? "OK" : "ERROR",
      pool: {
        healthy: healthStatus.healthy,
        stats: healthStatus.stats
          ? {
              totalConnections: healthStatus.stats.totalCount,
              usedConnections: healthStatus.stats.usedCount,
              idleConnections: healthStatus.stats.idleCount,
              waitingConnections: healthStatus.stats.waitingCount,
              usagePercent: healthStatus.stats.usagePercent,
              maxConnections: healthStatus.stats.maxConnections,
            }
          : null,
      },
      connectivity: {
        status: connectivityStatus,
        queryLatency: queryLatency ? `${queryLatency}ms` : null,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
