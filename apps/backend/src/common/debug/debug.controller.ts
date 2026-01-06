import {
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { sql } from "drizzle-orm";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { RedisStoreService } from "../../modules/redis-store/redis-store.service";
import { AppConfigService } from "../config/app.config.service";
import { EnvOverrideService } from "../config/env-override.service";
import { SandboxConfigService } from "../config/sandbox.config";
import { Public } from "../decorators/public.decorator";
import { Roles } from "../decorators/roles.decorator";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { RolesGuard } from "../guards/roles.guard";

@ApiTags("admin")
@Controller("_debug")
export class DebugController {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly redisStore: RedisStoreService,
    private readonly appConfig: AppConfigService,
    private readonly sandboxConfig: SandboxConfigService,
    private readonly envOverride: EnvOverrideService,
  ) {}

  @Get("health")
  @Public()
  @ApiOperation({ summary: "Debug health check" })
  @ApiResponse({ status: 200, description: "Health status" })
  async getHealth() {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      status: dbStatus.healthy && redisStatus.healthy ? "healthy" : "unhealthy",
      database: dbStatus,
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("config")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get configuration (admin only)" })
  @ApiResponse({ status: 200, description: "Configuration details" })
  async getConfig() {
    return {
      nodeEnv: this.appConfig.getNodeEnv(),
      sandbox: this.sandboxConfig.getSandboxRestrictions(),
      environment: {
        port: this.appConfig.getPort(),
        database: {
          connected: true, // Simplified
        },
        redis: {
          connected: await this.checkRedis().then((r) => r.healthy),
        },
      },
      overrides: this.envOverride.getAllOverrides(),
    };
  }

  @Get("database/stats")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get database statistics" })
  @ApiResponse({ status: 200, description: "Database statistics" })
  async getDatabaseStats() {
    const tables = [
      "users",
      "customers",
      "products",
      "orders",
      "carts",
      "categories",
      "discounts",
    ];

    const stats: Record<string, number> = {};

    for (const table of tables) {
      try {
        const result = await this.db.execute(
          sql.raw(`SELECT COUNT(*) as count FROM ${table}`),
        );
        const countValue = result.rows[0]?.count;
        stats[table] =
          typeof countValue === "string"
            ? parseInt(countValue, 10)
            : typeof countValue === "number"
              ? countValue
              : parseInt(String(countValue || "0"), 10);
      } catch (_error) {
        stats[table] = -1; // Error
      }
    }

    return {
      tables: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("redis/info")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get Redis information" })
  @ApiResponse({ status: 200, description: "Redis information" })
  async getRedisInfo() {
    try {
      const client = await this.redisStore.getClient();
      const info = await client.info("stats");
      const keyspace = await client.info("keyspace");

      return {
        connected: true,
        info: info.split("\n").filter((line) => line && !line.startsWith("#")),
        keyspace: keyspace
          .split("\n")
          .filter((line) => line && !line.startsWith("#")),
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  @Post("redis/flush")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Flush Redis (admin only, dangerous!)" })
  @ApiResponse({ status: 200, description: "Redis flushed" })
  async flushRedis(@Query("confirm") confirm: string) {
    if (confirm !== "yes" || process.env.NODE_ENV === "production") {
      throw new Error(
        "Redis flush requires confirmation and cannot be run in production",
      );
    }

    const client = await this.redisStore.getClient();
    await client.flushdb();

    return { message: "Redis flushed successfully" };
  }

  @Get("sandbox")
  @Public()
  @ApiOperation({ summary: "Get sandbox mode status" })
  @ApiResponse({ status: 200, description: "Sandbox status" })
  async getSandboxStatus() {
    return this.sandboxConfig.getSandboxRestrictions();
  }

  @Get("env-overrides")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get environment overrides" })
  @ApiResponse({ status: 200, description: "Environment overrides" })
  async getEnvOverrides() {
    return {
      overrides: this.envOverride.getAllOverrides(),
      count: Object.keys(this.envOverride.getAllOverrides()).length,
    };
  }

  @Get("performance")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get performance metrics" })
  @ApiResponse({ status: 200, description: "Performance metrics" })
  async getPerformanceMetrics() {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      },
      uptime: {
        seconds: Math.round(uptime),
        formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
      },
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  private async checkDatabase(): Promise<{ healthy: boolean; error?: string }> {
    try {
      await this.db.execute(sql.raw("SELECT 1"));
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkRedis(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const client = await this.redisStore.getClient();
      await client.ping();
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
