import { Injectable, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { SCRIPT_LOAD_TIMEOUT_MS } from "../../../common/constants/timeout.constants";
import { RedisStoreService } from "../redis-store.service";
import { loadLuaScript } from "./inventory-store";

@Injectable()
export class HeartbeatStore implements OnModuleInit {
  private client!: Redis;
  private updateHeartbeatScriptSha: string | null = null;

  constructor(
    private readonly redisStoreService: RedisStoreService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    try {
      this.client = await this.redisStoreService.getClient();

      const script = loadLuaScript("update-heartbeat.lua", __dirname);
      this.updateHeartbeatScriptSha = (await Promise.race([
        this.client.script("LOAD", script),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Script load timeout")), SCRIPT_LOAD_TIMEOUT_MS),
        ),
      ])) as string;

      this.logger.info(
        createLogContext(this.contextService, "onModuleInit", {
          scriptName: "update-heartbeat.lua",
        }),
        "Heartbeat Lua script loaded successfully",
      );
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "heartbeatInit", error),
        "Heartbeat script not loaded - will retry when Redis is available",
      );
    }
  }

  /**
   * Record heartbeat for a cart (atomic operation)
   */
  async recordHeartbeat(cartId: string, ttl: number = 120): Promise<void> {
    if (!this.updateHeartbeatScriptSha) {
      throw new Error("Heartbeat Lua script not loaded");
    }

    const heartbeatKey = `heartbeat:${cartId}`;
    const staleKey = `cart:stale:${cartId}`;
    const checkoutLockKey = `checkout:lock:${cartId}`;

    try {
      const result = await this.client.evalsha(
        this.updateHeartbeatScriptSha,
        3,
        heartbeatKey,
        staleKey,
        checkoutLockKey,
        ttl.toString(),
      );

      // Lua script returns: {ok = true} or {ok = false, reason = '...'}
      // Redis converts to array: ['ok', true] or ['ok', false, 'reason', '...']
      if (Array.isArray(result)) {
        if (result[0] === "ok" && result[1] === false) {
          // Checkout in progress or cart is stale - skip heartbeat update
          const reason = result[3] as string; // reason is at index 3
          if (reason === "CHECKOUT_IN_PROGRESS") {
            this.logger.debug(
              createLogContext(this.contextService, "recordHeartbeat", {
                cartId,
                reason: "checkout_in_progress",
              }),
              `Heartbeat skipped for cart ${cartId} - checkout in progress`,
            );
            return;
          }
          if (reason === "CART_STALE") {
            this.logger.debug(
              createLogContext(this.contextService, "recordHeartbeat", {
                cartId,
                reason: "cart_stale",
              }),
              `Heartbeat skipped for cart ${cartId} - cart is stale`,
            );
            return;
          }
        }
      }

      this.logger.debug(
        createLogContext(this.contextService, "recordHeartbeat", {
          cartId,
          ttl,
        }),
        `Recorded heartbeat for cart ${cartId}`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "recordHeartbeat", error, {
          cartId,
          ttl,
        }),
        `Failed to record heartbeat for cart ${cartId}`,
      );
      throw error;
    }
  }

  /**
   * Check if cart is active (has recent heartbeat)
   */
  async isCartActive(cartId: string): Promise<boolean> {
    const heartbeatKey = `heartbeat:${cartId}`;
    try {
      const exists = await this.client.exists(heartbeatKey);
      return exists === 1;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "isCartActive", error, {
          cartId,
        }),
        `Failed to check cart activity for cart ${cartId}`,
      );
      throw error;
    }
  }

  /**
   * Mark cart as stale (for cleanup)
   */
  async markCartStale(cartId: string): Promise<void> {
    const staleKey = `cart:stale:${cartId}`;
    try {
      // Set stale marker with TTL (5 min safety net)
      await this.client.setex(staleKey, 300, "1");
      this.logger.debug(
        createLogContext(this.contextService, "markCartStale", {
          cartId,
        }),
        `Marked cart ${cartId} as stale`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "markCartStale", error, {
          cartId,
        }),
        `Failed to mark cart ${cartId} as stale`,
      );
      throw error;
    }
  }
}
