import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis, { RedisOptions } from "ioredis";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { SCRIPT_LOAD_TIMEOUT_MS } from "../../common/constants/timeout.constants";

@Injectable()
export class RedisStoreService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private initPromise: Promise<void> | null = null;
  private isInitializing = false;

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get Redis client instance
   * Returns client immediately - client object is created synchronously
   * Connection happens in background and will retry automatically
   *
   * This method handles lazy initialization if called before onModuleInit()
   * Following NestJS best practices for async initialization
   */
  async getClient(): Promise<Redis> {
    if (this.client) {
      return this.client;
    }

    // If not initializing yet, start initialization synchronously
    // This handles the case where getClient() is called before onModuleInit()
    // NestJS doesn't guarantee onModuleInit() order, so we need this fallback
    if (!this.isInitializing && !this.initPromise) {
      this.isInitializing = true;
      // Create client synchronously first - this is immediate
      this.createClientSync();
      // Then start async connection process in background
      this.initPromise = this.initializeRedis();
    }

    // Client should exist now since createClientSync() is synchronous
    // Return it immediately - connection happens in background
    if (this.client) {
      return this.client;
    }

    // If somehow client doesn't exist (shouldn't happen), create it synchronously
    // This ensures we always return a client object immediately
    this.createClientSync();

    if (!this.client) {
      throw new Error("Failed to create Redis client - this should not happen");
    }

    return this.client;
  }

  /**
   * Create Redis client synchronously
   * This ensures the client object exists immediately
   */
  private createClientSync(): void {
    if (this.client) {
      return;
    }

    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const options: RedisOptions = {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        // Return null after 10 retries to stop retrying
        if (times > 10) {
          return null;
        }
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true, // Use lazy connect to avoid blocking startup
      connectTimeout: 5000, // 5 second connection timeout
      commandTimeout: 5000, // 5 second command timeout
      enableOfflineQueue: true, // Queue commands when offline - they'll execute when Redis connects
    };

    // Create client synchronously - this doesn't block
    // The client object is available immediately, connection happens later
    this.client = new Redis(redisUrl, options);
  }

  /**
   * Initialize Redis connection
   * Called by NestJS during module initialization lifecycle
   * Non-blocking - allows app to start even if Redis is unavailable
   */
  async onModuleInit() {
    // Create client synchronously first to ensure it's available immediately
    if (!this.client) {
      this.isInitializing = true;
      this.createClientSync();
    }

    // Store initialization promise so getClient() can await it
    // Only create if it doesn't exist (might have been created by getClient() call)
    if (!this.initPromise) {
      this.initPromise = this.initializeRedis();
    }
    // Don't wait for initialization - let it happen in background
    // This prevents blocking app startup if Redis is unavailable
    this.initPromise.catch((error) => {
      this.logger.warn(
        createErrorContext(this.contextService, "redisInitBackground", error),
        "Redis initialization failed in background - app started successfully",
      );
    });
  }

  private async initializeRedis() {
    // Ensure client exists (should already be created by createClientSync)
    if (!this.client) {
      this.createClientSync();
    }

    if (!this.client) {
      throw new Error("Failed to create Redis client");
    }

    // Set up event handlers
    try {
      this.client.on("connect", () => {
        this.logger.info(
          createLogContext(this.contextService, "redisConnect", {}),
          "Redis client connecting",
        );
      });

      this.client.on("ready", () => {
        this.logger.info(
          createLogContext(this.contextService, "redisReady", {}),
          "Redis client ready",
        );
      });

      this.client.on("error", (error) => {
        this.logger.error(
          createErrorContext(this.contextService, "redisError", error),
          "Redis client error",
        );
      });

      this.client.on("close", () => {
        this.logger.warn(
          createLogContext(this.contextService, "redisClose", {}),
          "Redis client connection closed",
        );
      });

      this.client.on("reconnecting", () => {
        this.logger.info(
          createLogContext(this.contextService, "redisReconnecting", {}),
          "Redis client reconnecting",
        );
      });

      // Start connection in background - don't wait for it
      // This allows the app to start even if Redis is unavailable
      this.client.connect().catch((error) => {
        this.logger.warn(
          createErrorContext(
            this.contextService,
            "redisConnectBackground",
            error,
            {
              redisUrl: process.env.REDIS_URL || "default",
            },
          ),
          "Redis connection failed - will retry in background. Application started successfully.",
        );
      });

      // Try to verify connection with timeout, but don't block
      // If it fails, the client will retry automatically
      Promise.race([
        this.client.ping(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Redis ping timeout")), SCRIPT_LOAD_TIMEOUT_MS + 1000), // Slightly longer than script load timeout
        ),
      ])
        .then(() => {
          this.logger.info(
            createLogContext(this.contextService, "redisConnected", {
              redisUrl: process.env.REDIS_URL || "default",
            }),
            "Redis client connected successfully",
          );
        })
        .catch((error) => {
          this.logger.warn(
            createErrorContext(this.contextService, "redisPingTimeout", error, {
              redisUrl: process.env.REDIS_URL || "default",
            }),
            "Redis ping timeout - connection may still be establishing. Redis will retry automatically.",
          );
        });
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "redisInit", error, {
          redisUrl: process.env.REDIS_URL || "default",
        }),
        "Failed to initialize Redis client - application will start but Redis features may be unavailable",
      );
      // Don't throw - allow application to start
      // Keep client so it can retry connection
    }
  }

  /**
   * Cleanup Redis connection
   */
  async onModuleDestroy() {
    if (this.client) {
      this.logger.info(
        createLogContext(this.contextService, "redisDisconnect", {}),
        "Disconnecting Redis client",
      );
      await this.client.quit();
      this.client = null;
      this.logger.info(
        createLogContext(this.contextService, "redisDisconnected", {}),
        "Redis client disconnected",
      );
    }
  }
}
