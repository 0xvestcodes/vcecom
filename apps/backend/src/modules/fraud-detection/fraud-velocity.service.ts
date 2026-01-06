import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  eq,
  fraudVelocityChecks,
  gte,
  orders,
  payments,
  refunds,
} from "@vcecom/db";
import { count } from "drizzle-orm";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createLogContext } from "../../common/logging/logging.helper";
import { Trace } from "../../common/tracing/trace.decorator";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";

export type VelocityCheckType = "order" | "payment" | "return";

export interface VelocityCheckResult {
  exceeded: boolean;
  count: number;
  threshold: number;
  windowMinutes: number;
}

export interface VelocityCheckConfig {
  orderThreshold: number; // Max orders in window
  orderWindowMinutes: number; // Time window in minutes
  paymentThreshold: number; // Max payments in window
  paymentWindowMinutes: number;
  returnThreshold: number; // Max returns in window
  returnWindowMinutes: number;
}

/**
 * Service for checking velocity (frequency) of orders, payments, and returns
 */
@Injectable()
export class FraudVelocityService {
  private readonly defaultConfig: VelocityCheckConfig = {
    orderThreshold: 5, // 5 orders
    orderWindowMinutes: 60, // in 1 hour
    paymentThreshold: 10, // 10 payments
    paymentWindowMinutes: 60, // in 1 hour
    returnThreshold: 3, // 3 returns
    returnWindowMinutes: 30 * 24 * 60, // in 30 days
  };

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Check order velocity for a customer
   */
  @Trace({ operation: "FraudVelocityService.checkOrderVelocity" })
  async checkOrderVelocity(
    customerId: string,
    config?: Partial<VelocityCheckConfig>,
  ): Promise<VelocityCheckResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const windowStart = new Date(
      Date.now() - finalConfig.orderWindowMinutes * 60 * 1000,
    );

    const orderCount = await this.db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.customerId, customerId),
          gte(orders.createdAt, windowStart),
        ),
      );

    const countValue = orderCount[0]?.count || 0;
    const exceeded = countValue >= finalConfig.orderThreshold;

    if (exceeded) {
      this.logger.warn(
        createLogContext(this.contextService, "checkOrderVelocity", {
          customerId,
          count: countValue,
          threshold: finalConfig.orderThreshold,
          windowMinutes: finalConfig.orderWindowMinutes,
        }),
        "Order velocity threshold exceeded",
      );
    }

    // Record velocity check
    await this.recordVelocityCheck(
      customerId,
      "order",
      countValue,
      windowStart,
      new Date(),
    );

    return {
      exceeded,
      count: countValue,
      threshold: finalConfig.orderThreshold,
      windowMinutes: finalConfig.orderWindowMinutes,
    };
  }

  /**
   * Check payment velocity for a customer
   */
  @Trace({ operation: "FraudVelocityService.checkPaymentVelocity" })
  async checkPaymentVelocity(
    customerId: string,
    config?: Partial<VelocityCheckConfig>,
  ): Promise<VelocityCheckResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const windowStart = new Date(
      Date.now() - finalConfig.paymentWindowMinutes * 60 * 1000,
    );

    // Get payments through orders
    const paymentCount = await this.db
      .select({ count: count() })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(
        and(
          eq(orders.customerId, customerId),
          gte(payments.createdAt, windowStart),
        ),
      );

    const countValue = paymentCount[0]?.count || 0;
    const exceeded = countValue >= finalConfig.paymentThreshold;

    if (exceeded) {
      this.logger.warn(
        createLogContext(this.contextService, "checkPaymentVelocity", {
          customerId,
          count: countValue,
          threshold: finalConfig.paymentThreshold,
          windowMinutes: finalConfig.paymentWindowMinutes,
        }),
        "Payment velocity threshold exceeded",
      );
    }

    // Record velocity check
    await this.recordVelocityCheck(
      customerId,
      "payment",
      countValue,
      windowStart,
      new Date(),
    );

    return {
      exceeded,
      count: countValue,
      threshold: finalConfig.paymentThreshold,
      windowMinutes: finalConfig.paymentWindowMinutes,
    };
  }

  /**
   * Check return velocity for a customer
   */
  @Trace({ operation: "FraudVelocityService.checkReturnVelocity" })
  async checkReturnVelocity(
    customerId: string,
    config?: Partial<VelocityCheckConfig>,
  ): Promise<VelocityCheckResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const windowStart = new Date(
      Date.now() - finalConfig.returnWindowMinutes * 60 * 1000,
    );

    // Get returns through orders
    const returnCount = await this.db
      .select({ count: count() })
      .from(refunds)
      .innerJoin(orders, eq(refunds.orderId, orders.id))
      .where(
        and(
          eq(orders.customerId, customerId),
          gte(refunds.createdAt, windowStart),
        ),
      );

    const countValue = returnCount[0]?.count || 0;
    const exceeded = countValue >= finalConfig.returnThreshold;

    if (exceeded) {
      this.logger.warn(
        createLogContext(this.contextService, "checkReturnVelocity", {
          customerId,
          count: countValue,
          threshold: finalConfig.returnThreshold,
          windowMinutes: finalConfig.returnWindowMinutes,
        }),
        "Return velocity threshold exceeded",
      );
    }

    // Record velocity check
    await this.recordVelocityCheck(
      customerId,
      "return",
      countValue,
      windowStart,
      new Date(),
    );

    return {
      exceeded,
      count: countValue,
      threshold: finalConfig.returnThreshold,
      windowMinutes: finalConfig.returnWindowMinutes,
    };
  }

  /**
   * Record a velocity check for audit purposes
   */
  private async recordVelocityCheck(
    customerId: string,
    checkType: VelocityCheckType,
    count: number,
    windowStart: Date,
    windowEnd: Date,
  ) {
    try {
      await this.db.insert(fraudVelocityChecks).values({
        customerId,
        checkType,
        count,
        windowStart,
        windowEnd,
      });
    } catch (error) {
      // Log but don't fail - velocity recording is non-critical
      this.logger.warn(
        createLogContext(this.contextService, "recordVelocityCheck", {
          customerId,
          checkType,
          error: error instanceof Error ? error.message : String(error),
        }),
        "Failed to record velocity check",
      );
    }
  }
}
