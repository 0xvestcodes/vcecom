import { Injectable, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { PinoLogger } from "nestjs-pino";
import { CHECKOUT_LOCK_TTL } from "../../../common/constants/inventory.constants";
import { ContextService } from "../../../common/logging/context.service";
import { SCRIPT_LOAD_TIMEOUT_MS } from "../../../common/constants/timeout.constants";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { RedisStoreService } from "../redis-store.service";
import { loadLuaScript } from "./inventory-store";

@Injectable()
export class CheckoutLockStore implements OnModuleInit {
  private client!: Redis;
  private setCheckoutLockScriptSha: string | null = null;

  constructor(
    private readonly redisStoreService: RedisStoreService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    try {
      this.client = await this.redisStoreService.getClient();

      const script = loadLuaScript("set-checkout-lock.lua", __dirname);
      this.setCheckoutLockScriptSha = (await Promise.race([
        this.client.script("LOAD", script),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Script load timeout")), SCRIPT_LOAD_TIMEOUT_MS),
        ),
      ])) as string;

      this.logger.info(
        createLogContext(this.contextService, "onModuleInit", {
          scriptName: "set-checkout-lock.lua",
        }),
        "Checkout lock Lua script loaded successfully",
      );
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "checkoutLockInit", error),
        "Checkout lock script not loaded - will retry when Redis is available",
      );
    }
  }

  /**
   * Set checkout lock to freeze reservations during checkout
   */
  async setCheckoutLock(
    cartId: string,
    ttl: number = CHECKOUT_LOCK_TTL,
  ): Promise<void> {
    if (!this.setCheckoutLockScriptSha) {
      throw new Error("Checkout lock Lua script not loaded");
    }

    const lockKey = `checkout:lock:${cartId}`;

    try {
      await this.client.evalsha(
        this.setCheckoutLockScriptSha,
        1,
        lockKey,
        ttl.toString(),
      );

      this.logger.debug(
        createLogContext(this.contextService, "setCheckoutLock", {
          cartId,
          ttl,
        }),
        `Set checkout lock for cart ${cartId}`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "setCheckoutLock", error, {
          cartId,
          ttl,
        }),
        `Failed to set checkout lock for cart ${cartId}`,
      );
      throw error;
    }
  }

  /**
   * Check if checkout lock exists
   */
  async hasCheckoutLock(cartId: string): Promise<boolean> {
    const lockKey = `checkout:lock:${cartId}`;
    try {
      const exists = await this.client.exists(lockKey);
      return exists === 1;
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "hasCheckoutLock", error, {
          cartId,
        }),
        `Failed to check checkout lock for cart ${cartId}`,
      );
      throw error;
    }
  }

  /**
   * Clear checkout lock
   */
  async clearCheckoutLock(cartId: string): Promise<void> {
    const lockKey = `checkout:lock:${cartId}`;
    try {
      await this.client.del(lockKey);
      this.logger.debug(
        createLogContext(this.contextService, "clearCheckoutLock", {
          cartId,
        }),
        `Cleared checkout lock for cart ${cartId}`,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(this.contextService, "clearCheckoutLock", error, {
          cartId,
        }),
        `Failed to clear checkout lock for cart ${cartId}`,
      );
      throw error;
    }
  }
}
