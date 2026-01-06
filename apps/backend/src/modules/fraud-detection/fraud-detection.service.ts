import { Inject, Injectable } from "@nestjs/common";
import { addresses, customers, eq, fraudRiskScores } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createLogContext } from "../../common/logging/logging.helper";
import { Trace } from "../../common/tracing/trace.decorator";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import { NotificationsService } from "../notifications/notifications.service";
import { FraudBlacklistService } from "./fraud-blacklist.service";
import { FraudDuplicateDetectionService } from "./fraud-duplicate-detection.service";
import {
  FraudRiskScoringService,
  type RiskFactors,
  RiskScoreResult,
} from "./fraud-risk-scoring.service";
import { FraudVelocityService } from "./fraud-velocity.service";

export interface FraudCheckResult {
  riskScore: RiskScoreResult;
  riskScoreId: string;
  flagged: boolean;
  message: string;
}

/**
 * Main fraud detection service that orchestrates all fraud checks
 */
@Injectable()
export class FraudDetectionService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
    readonly _blacklistService: FraudBlacklistService,
    private readonly riskScoringService: FraudRiskScoringService,
    readonly _duplicateDetectionService: FraudDuplicateDetectionService,
    readonly _velocityService: FraudVelocityService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Perform comprehensive fraud check for an order
   */
  @Trace({ operation: "FraudDetectionService.performFraudCheck" })
  async performFraudCheck(
    orderId: string,
    customerId: string,
    email: string,
    phone: string,
    shippingAddressId: string,
    billingAddressId: string,
    orderValue: number,
    paymentMethod: string,
  ): Promise<FraudCheckResult> {
    // Get customer and address details
    const [customer, _shippingAddress] = await Promise.all([
      this.db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1),
      shippingAddressId
        ? this.db
            .select()
            .from(addresses)
            .where(eq(addresses.id, shippingAddressId))
            .limit(1)
        : null,
    ]);

    if (!customer || customer.length === 0) {
      throw new Error(`Customer ${customerId} not found`);
    }

    // Calculate risk score
    const riskScore = await this.riskScoringService.calculateRiskScore(
      customerId,
      email,
      phone,
      shippingAddressId,
      billingAddressId,
      orderValue,
      paymentMethod,
    );

    // Store risk score in database
    const riskScoreResult = await this.db
      .insert(fraudRiskScores)
      .values({
        orderId,
        riskScore: riskScore.score,
        riskFactors: riskScore.factors satisfies RiskFactors, // JSONB
        flagged: riskScore.flagged,
      })
      .returning();
    const riskScoreRecord = riskScoreResult[0];

    // Generate message based on risk level
    let message = "Order processed successfully";
    if (riskScore.flagged) {
      message = `High-risk order flagged (score: ${riskScore.score}). Manual review recommended.`;
    } else if (riskScore.riskLevel === "medium") {
      message = `Medium-risk order (score: ${riskScore.score}). Proceed with caution.`;
    }

    this.logger.info(
      createLogContext(this.contextService, "performFraudCheck", {
        orderId,
        customerId,
        riskScore: riskScore.score,
        riskLevel: riskScore.riskLevel,
        flagged: riskScore.flagged,
      }),
      message,
    );

    return {
      riskScore,
      riskScoreId: riskScoreRecord.id,
      flagged: riskScore.flagged,
      message,
    };
  }

  /**
   * Get risk score for an order
   */
  @Trace({ operation: "FraudDetectionService.getRiskScore" })
  async getRiskScore(orderId: string) {
    const [riskScore] = await this.db
      .select()
      .from(fraudRiskScores)
      .where(eq(fraudRiskScores.orderId, orderId))
      .limit(1);

    return riskScore || null;
  }

  /**
   * Mark order as reviewed by admin
   */
  @Trace({ operation: "FraudDetectionService.markOrderReviewed" })
  async markOrderReviewed(
    orderId: string,
    adminId: string,
    notes?: string,
  ): Promise<void> {
    await this.db
      .update(fraudRiskScores)
      .set({
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(fraudRiskScores.orderId, orderId));

    // Send review complete notification
    try {
      // Get order number for notification
      const [order] = await this.db
        .select()
        .from(fraudRiskScores)
        .where(eq(fraudRiskScores.orderId, orderId))
        .limit(1);

      if (order) {
        await this.notificationsService.sendFraudReviewComplete(
          orderId,
          `ORD-${orderId.slice(-6)}`, // Simplified order number format
          adminId,
        );
      }
    } catch (notificationError) {
      // Log but don't fail the review
      this.logger.warn(
        createLogContext(
          this.contextService,
          "markOrderReviewed.notification",
          {
            orderId,
            notificationError:
              notificationError instanceof Error
                ? notificationError.message
                : String(notificationError),
          },
        ),
        "Failed to send review complete notification",
      );
    }

    this.logger.info(
      createLogContext(this.contextService, "markOrderReviewed", {
        orderId,
        adminId,
        notes,
      }),
      "Order marked as reviewed by admin",
    );
  }

  /**
   * Get flagged orders for admin review
   */
  @Trace({ operation: "FraudDetectionService.getFlaggedOrders" })
  async getFlaggedOrders(limit = 50, offset = 0) {
    return this.db
      .select()
      .from(fraudRiskScores)
      .where(eq(fraudRiskScores.flagged, true))
      .orderBy(fraudRiskScores.createdAt)
      .limit(limit)
      .offset(offset);
  }
}
