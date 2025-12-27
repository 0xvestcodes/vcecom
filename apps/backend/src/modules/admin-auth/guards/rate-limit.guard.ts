import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleInit,
} from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { RedisStoreService } from "../../redis-store/redis-store.service";

@Injectable()
export class AdminLoginRateLimitGuard implements OnModuleInit {
  private readonly rateLimitKeyPrefix = "admin:login:ip:";
  private readonly limit = process.env.ADMIN_LOGIN_RATE_LIMIT
    ? parseInt(process.env.ADMIN_LOGIN_RATE_LIMIT, 10)
    : Number.MAX_SAFE_INTEGER; // Effectively unlimited (temporarily)
  private readonly ttl = parseInt(
    process.env.ADMIN_LOGIN_RATE_WINDOW || "600",
    10,
  ); // 10 minutes (600 seconds)

  constructor(
    private readonly redisStoreService: RedisStoreService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  onModuleInit() {
    // Ensure Redis client is initialized
    this.redisStoreService.getClient();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ipAddress =
      (request.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      (request.headers["x-real-ip"] as string) ||
      request.socket.remoteAddress ||
      "unknown";

    const key = `${this.rateLimitKeyPrefix}${ipAddress}`;

    try {
      const client = await this.redisStoreService.getClient();
      const execResult = await client
        .multi()
        .incr(key)
        .expire(key, this.ttl)
        .exec();

      if (!execResult) {
        this.logger.error(
          createLogContext(this.contextService, "adminLoginRateLimit", {
            ipAddress,
            error: "Redis transaction returned null",
          }),
          "Redis transaction failed - allowing request to proceed (fail-safe)",
        );
        // Fail-safe: allow request if Redis transaction fails
        return true;
      }

      const count = execResult[0]?.[1] as number | undefined;
      const ttl = execResult[1]?.[1] as number | undefined;

      if (count && count > this.limit) {
        this.logger.warn(
          createLogContext(this.contextService, "adminLoginRateLimit", {
            ipAddress,
            count,
            limit: this.limit,
            ttl,
          }),
          "Admin login rate limit exceeded",
        );
        throw new HttpException(
          `Too many login attempts from this IP address. Please try again after ${ttl} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      this.logger.debug(
        createLogContext(this.contextService, "adminLoginRateLimit", {
          ipAddress,
          count,
          limit: this.limit,
          ttl,
        }),
        "Admin login attempt within rate limit",
      );

      return true;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "adminLoginRateLimit", error, {
          ipAddress,
        }),
        "Error checking admin login rate limit",
      );
      // If Redis is down or an error occurs, fail safe by allowing the request
      // This prevents login from being blocked when Redis is unavailable
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        throw error;
      }

      this.logger.error(
        createLogContext(this.contextService, "adminLoginRateLimit", {
          ipAddress,
          error: error.message || "Unknown Redis error",
        }),
        "Redis error during rate limit check - allowing request to proceed (fail-safe)",
      );

      // Allow the request to proceed when Redis is unavailable
      return true;
    }
  }
}
