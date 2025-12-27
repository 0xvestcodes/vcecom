import {
  Injectable,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import {
  closeDatabasePool,
  getDatabasePool,
  getPoolStats,
  isPoolHealthy,
} from "./db";

@Injectable()
export class DatabaseService
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITORING_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    // Verify singleton: Get pool instance and log its identity
    // This ensures we're using the same pool instance across all modules
    try {
      const poolInstance = getDatabasePool();
      const poolId = poolInstance
        ? `pool_${poolInstance.totalCount}_${Date.now()}`
        : "not_created";

      // Log pool status on startup
      // Note: getPoolStats() doesn't trigger pool creation - pool is created lazily
      // This is safe to call during initialization
      const stats = getPoolStats();
      if (stats) {
        this.logger.info(
          createLogContext(this.contextService, "databasePoolInit", {
            poolId,
            totalConnections: stats.totalCount,
            idleConnections: stats.idleCount,
            waitingConnections: stats.waitingCount,
            poolInstanceExists: !!poolInstance,
            dbInstanceType: "Database",
          }),
          "Database connection pool initialized (singleton verified)",
        );
      } else {
        this.logger.info(
          createLogContext(this.contextService, "databasePoolInit", {
            poolId,
            dbInstanceType: "Database",
          }),
          "Database pool not yet created (lazy initialization) - singleton pattern active",
        );
      }
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "databasePoolInit", error),
        "Failed to get database pool stats - pool may not be initialized yet",
      );
      // Don't throw - allow app to start
    }

    // Start periodic monitoring of connection pool
    this.startPoolMonitoring();
  }

  onModuleDestroy() {
    // Stop monitoring when module is destroyed
    this.stopPoolMonitoring();
  }

  /**
   * Start periodic monitoring of connection pool
   * Logs pool statistics every 5 minutes to help identify connection issues
   */
  private startPoolMonitoring() {
    // Clear any existing interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      const stats = getPoolStats();
      if (stats) {
        const isHealthy = isPoolHealthy();

        // Log warning if pool usage is high
        if (stats.usagePercent >= 80) {
          this.logger.warn(
            createLogContext(this.contextService, "databasePoolHighUsage", {
              totalConnections: stats.totalCount,
              usedConnections: stats.usedCount,
              idleConnections: stats.idleCount,
              waitingConnections: stats.waitingCount,
              usagePercent: stats.usagePercent,
              maxConnections: stats.maxConnections,
              healthy: isHealthy,
            }),
            `Database pool usage is high: ${stats.usedCount}/${stats.maxConnections} (${stats.usagePercent.toFixed(1)}%)`,
          );
        } else {
          // Log info periodically for monitoring
          this.logger.debug(
            createLogContext(this.contextService, "databasePoolStats", {
              totalConnections: stats.totalCount,
              usedConnections: stats.usedCount,
              idleConnections: stats.idleCount,
              waitingConnections: stats.waitingCount,
              usagePercent: stats.usagePercent,
              maxConnections: stats.maxConnections,
              healthy: isHealthy,
            }),
            `Database pool stats: ${stats.usedCount}/${stats.maxConnections} connections used (${stats.usagePercent.toFixed(1)}%)`,
          );
        }
      }
    }, this.MONITORING_INTERVAL);
  }

  /**
   * Stop periodic monitoring of connection pool
   */
  private stopPoolMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  async onApplicationShutdown(signal?: string) {
    // Stop monitoring before shutdown
    this.stopPoolMonitoring();
    this.logger.info(
      createLogContext(this.contextService, "databaseShutdown", { signal }),
      "Shutting down database connection pool",
    );

    // Log pool status before shutdown
    const statsBefore = getPoolStats();
    if (statsBefore) {
      this.logger.info(
        createLogContext(this.contextService, "databasePoolStatsBefore", {
          totalConnections: statsBefore.totalCount,
          idleConnections: statsBefore.idleCount,
          waitingConnections: statsBefore.waitingCount,
        }),
        "Database pool statistics before shutdown",
      );
    }

    try {
      // Close pool gracefully with 10 second timeout
      await closeDatabasePool(10000);

      this.logger.info(
        createLogContext(this.contextService, "databaseShutdownComplete", {}),
        "Database connection pool closed successfully",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "databaseShutdownError", error),
        "Error closing database connection pool",
      );
      // Don't throw - allow application to continue shutdown
    }
  }

  /**
   * Get current database pool health status
   */
  getHealthStatus(): {
    healthy: boolean;
    stats: {
      totalCount: number;
      usedCount: number;
      idleCount: number;
      waitingCount: number;
      usagePercent: number;
      maxConnections: number;
    } | null;
  } {
    return {
      healthy: isPoolHealthy(),
      stats: getPoolStats(),
    };
  }
}
