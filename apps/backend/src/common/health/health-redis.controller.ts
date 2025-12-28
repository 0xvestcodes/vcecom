import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { RedisHealthService } from "../../modules/admin/services/redis-health.service";
import { Public } from "../decorators/public.decorator";

@ApiTags("admin")
@Controller("_health")
@Public()
export class HealthRedisController {
  constructor(private readonly redisHealthService: RedisHealthService) {}

  @Get("redis")
  @ApiOperation({
    summary: "Redis health check",
    description:
      "Returns Redis connection status, memory usage, client counts, and keyspace statistics",
  })
  @ApiResponse({
    status: 200,
    description: "Redis health status",
  })
  async getRedisHealth() {
    return this.redisHealthService.getHealth();
  }
}
