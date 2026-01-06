import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, orders, payments } from "@vcecom/db";
import { count } from "drizzle-orm";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createLogContext } from "../../common/logging/logging.helper";
import { Trace } from "../../common/tracing/trace.decorator";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import { FraudBlacklistService } from "./fraud-blacklist.service";
import { FraudDuplicateDetectionService } from "./fraud-duplicate-detection.service";
import { FraudVelocityService } from "./fraud-velocity.service";

export interface RiskFactors {
  isCodOrder: boolean;
  highOrderValue: boolean;
  newCustomer: boolean;
  velocityOrders: boolean;
  velocityPayments: boolean;
  velocityReturns: boolean;
  blacklistEmail: boolean;
  blacklistPhone: boolean;
  blacklistAddress: boolean;
  duplicateCustomer: boolean;
  failedPayments: boolean;
  addressMismatch: boolean;
}

export interface RiskScoreResult {
  score: number;
  factors: RiskFactors;
  flagged: boolean;
  riskLevel: "low" | "medium" | "high";
}

/**
 * Service for calculating risk scores based on multiple fraud indicators
 */
@Injectable()
export class FraudRiskScoringService {
  private readonly HIGH_RISK_THRESHOLD = 70;
  private readonly MEDIUM_RISK_THRESHOLD = 40;
  private readonly HIGH_ORDER_VALUE_THRESHOLD = 50000; // ₹50,000
  private readonly NEW_CUSTOMER_DAYS = 30;

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly blacklistService: FraudBlacklistService,
    private readonly duplicateDetectionService: FraudDuplicateDetectionService,
    private readonly velocityService: FraudVelocityService,
  ) {}

  /**
   * Calculate risk score for an order
   */
  @Trace({ operation: "FraudRiskScoringService.calculateRiskScore" })
  async calculateRiskScore(
    customerId: string,
    email: string,
    phone: string,
    shippingAddressId: string,
    billingAddressId: string,
    orderValue: number,
    paymentMethod: string,
  ): Promise<RiskScoreResult> {
    const factors: RiskFactors = {
      isCodOrder: false,
      highOrderValue: false,
      newCustomer: false,
      velocityOrders: false,
      velocityPayments: false,
      velocityReturns: false,
      blacklistEmail: false,
      blacklistPhone: false,
      blacklistAddress: false,
      duplicateCustomer: false,
      failedPayments: false,
      addressMismatch: false,
    };

    let score = 0;

    // Check COD payment method (+10 points)
    if (paymentMethod === "cod") {
      factors.isCodOrder = true;
      score += 10;
    }

    // Check high order value (+5 points)
    if (orderValue > this.HIGH_ORDER_VALUE_THRESHOLD) {
      factors.highOrderValue = true;
      score += 5;
    }

    // Check new customer (+5 points)
    const isNewCustomer = await this.checkNewCustomer(customerId);
    if (isNewCustomer) {
      factors.newCustomer = true;
      score += 5;
    }

    // Check velocity - orders (+10 points if exceeded)
    const orderVelocity =
      await this.velocityService.checkOrderVelocity(customerId);
    if (orderVelocity.exceeded) {
      factors.velocityOrders = true;
      score += 10;
    }

    // Check velocity - payments (+10 points if exceeded)
    const paymentVelocity =
      await this.velocityService.checkPaymentVelocity(customerId);
    if (paymentVelocity.exceeded) {
      factors.velocityPayments = true;
      score += 10;
    }

    // Check velocity - returns (+10 points if exceeded)
    const returnVelocity =
      await this.velocityService.checkReturnVelocity(customerId);
    if (returnVelocity.exceeded) {
      factors.velocityReturns = true;
      score += 10;
    }

    // Check blacklists (+50 points each)
    const [emailCheck, phoneCheck, addressCheck] = await Promise.all([
      this.blacklistService.checkEmail(email),
      this.blacklistService.checkPhone(phone),
      this.checkAddressBlacklist(shippingAddressId),
    ]);

    if (emailCheck.isBlacklisted) {
      factors.blacklistEmail = true;
      score += 50;
    }
    if (phoneCheck.isBlacklisted) {
      factors.blacklistPhone = true;
      score += 50;
    }
    if (addressCheck.isBlacklisted) {
      factors.blacklistAddress = true;
      score += 50;
    }

    // Check duplicate customer (+15 points)
    const duplicateCheck =
      await this.duplicateDetectionService.checkDuplicateCustomer(
        customerId,
        email,
        phone,
        shippingAddressId,
      );
    if (duplicateCheck.isDuplicate) {
      factors.duplicateCustomer = true;
      score += 15;
    }

    // Check failed payments (+10 points)
    const hasFailedPayments = await this.checkFailedPayments(customerId);
    if (hasFailedPayments) {
      factors.failedPayments = true;
      score += 10;
    }

    // Check address mismatch (+5 points)
    const hasAddressMismatch = await this.checkAddressMismatch(
      shippingAddressId,
      billingAddressId,
    );
    if (hasAddressMismatch) {
      factors.addressMismatch = true;
      score += 5;
    }

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" = "low";
    if (score >= this.HIGH_RISK_THRESHOLD) {
      riskLevel = "high";
    } else if (score >= this.MEDIUM_RISK_THRESHOLD) {
      riskLevel = "medium";
    }

    const flagged = riskLevel === "high";

    if (flagged) {
      this.logger.warn(
        createLogContext(this.contextService, "calculateRiskScore", {
          customerId,
          score,
          riskLevel,
          factors,
        }),
        "High-risk order detected",
      );
    }

    return {
      score,
      factors,
      flagged,
      riskLevel,
    };
  }

  /**
   * Check if customer is new (< 30 days)
   */
  private async checkNewCustomer(customerId: string): Promise<boolean> {
    const [customer] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt))
      .limit(1);

    if (!customer) {
      return true; // No previous orders
    }

    const daysSinceFirstOrder =
      (Date.now() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceFirstOrder < this.NEW_CUSTOMER_DAYS;
  }

  /**
   * Check if customer has failed payments
   */
  private async checkFailedPayments(customerId: string): Promise<boolean> {
    const failedPayments = await this.db
      .select({ count: count() })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(
        and(
          eq(orders.customerId, customerId),
          eq(payments.status, "failed"),
          gte(
            payments.createdAt,
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          ), // Last 30 days
        ),
      );

    return (failedPayments[0]?.count || 0) > 0;
  }

  /**
   * Check if shipping and billing addresses differ
   */
  private async checkAddressMismatch(
    shippingAddressId: string,
    billingAddressId: string,
  ): Promise<boolean> {
    if (!shippingAddressId || !billingAddressId) {
      return false;
    }
    return shippingAddressId !== billingAddressId;
  }

  /**
   * Check if address is blacklisted
   */
  private async checkAddressBlacklist(addressId: string) {
    // Get address details and check blacklist
    // This would need address data - for now return false
    // In production, this would fetch address and check against blacklist
    return { isBlacklisted: false };
  }
}
