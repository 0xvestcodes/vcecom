import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  customers,
  eq,
  gte,
  isNull,
  loyaltyRules,
  lte,
  or,
} from "@vcecom/db";
import { SQL } from "drizzle-orm";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";

@Injectable()
export class LoyaltyRulesService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get active earning rules for a customer
   */
  async getActiveEarningRules(customerId: string) {
    try {
      // Get customer's group
      const [customer] = await this.db
        .select({
          customerGroupId: customers.customerGroupId,
        })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      const now = new Date();

      // Get rules: either group-specific or general (null customerGroupId)
      const rules = await this.db
        .select()
        .from(loyaltyRules)
        .where(
          and(
            eq(loyaltyRules.type, "earning"),
            eq(loyaltyRules.isActive, true),
            lte(loyaltyRules.validFrom, now),
            or(
              isNull(loyaltyRules.validUntil),
              gte(loyaltyRules.validUntil, now),
            ),
            or(
              isNull(loyaltyRules.customerGroupId),
              eq(loyaltyRules.customerGroupId, customer.customerGroupId || ""),
            ),
          ),
        )
        .orderBy(loyaltyRules.validFrom);

      return rules;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "getActiveEarningRules",
          error,
          { customerId },
        ),
        "Failed to get active earning rules",
      );
      throw error;
    }
  }

  /**
   * Get active redemption rules for a customer
   */
  async getActiveRedemptionRules(customerId: string) {
    try {
      // Get customer's group
      const [customer] = await this.db
        .select({
          customerGroupId: customers.customerGroupId,
        })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      const now = new Date();

      // Get rules: either group-specific or general (null customerGroupId)
      const rules = await this.db
        .select()
        .from(loyaltyRules)
        .where(
          and(
            eq(loyaltyRules.type, "redemption"),
            eq(loyaltyRules.isActive, true),
            lte(loyaltyRules.validFrom, now),
            or(
              isNull(loyaltyRules.validUntil),
              gte(loyaltyRules.validUntil, now),
            ),
            or(
              isNull(loyaltyRules.customerGroupId),
              eq(loyaltyRules.customerGroupId, customer.customerGroupId || ""),
            ),
          ),
        )
        .orderBy(loyaltyRules.validFrom);

      return rules;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "getActiveRedemptionRules",
          error,
          { customerId },
        ),
        "Failed to get active redemption rules",
      );
      throw error;
    }
  }

  /**
   * Calculate points to earn based on order value
   */
  async calculatePointsToEarn(
    customerId: string,
    orderValue: number,
  ): Promise<number> {
    const rules = await this.getActiveEarningRules(customerId);

    if (rules.length === 0) {
      return 0;
    }

    // Use the first applicable rule (highest priority)
    const rule = rules[0];

    // Check minimum order value
    if (orderValue < rule.minOrderValue) {
      return 0;
    }

    // Calculate points based on rule type
    switch (rule.ruleType) {
      case "percentage":
        // pointsPerRupee is the rate (e.g., 0.01 = 1 point per ₹100)
        return Math.floor(orderValue * rule.pointsPerRupee);
      case "fixed":
        // Fixed points regardless of order value
        return rule.pointsPerRupee > 0 ? Math.floor(rule.pointsPerRupee) : 0;
      case "tiered": {
        // Use tiered calculation from metadata
        const tiers = rule.metadata?.tierThresholds as
          | Array<{ min: number; pointsPerRupee: number }>
          | undefined;
        if (tiers) {
          // Find the applicable tier
          const applicableTier = tiers
            .sort((a, b) => b.min - a.min)
            .find((tier) => orderValue >= tier.min);
          if (applicableTier) {
            return Math.floor(orderValue * applicableTier.pointsPerRupee);
          }
        }
        // Fallback to default pointsPerRupee
        return Math.floor(orderValue * rule.pointsPerRupee);
      }
      default:
        return 0;
    }
  }

  /**
   * Calculate discount amount from points
   */
  async calculateDiscountFromPoints(
    customerId: string,
    pointsToRedeem: number,
    orderValue: number,
  ): Promise<{ discountAmount: number; pointsUsed: number }> {
    const rules = await this.getActiveRedemptionRules(customerId);

    if (rules.length === 0) {
      throw new BadRequestException("No active redemption rules found");
    }

    // Use the first applicable rule
    const rule = rules[0];

    // Check minimum points
    if (pointsToRedeem < rule.minPointsToRedeem) {
      throw new BadRequestException(
        `Minimum ${rule.minPointsToRedeem} points required to redeem`,
      );
    }

    // Check max points per order
    if (rule.maxPointsPerOrder && pointsToRedeem > rule.maxPointsPerOrder) {
      pointsToRedeem = rule.maxPointsPerOrder;
    }

    // Calculate discount amount
    // rupeesPerPoint is the rate (e.g., 0.01 = ₹1 per 100 points)
    const discountAmount = pointsToRedeem * rule.rupeesPerPoint;

    // Check max redemption percentage if specified
    const maxRedemptionPercentage = rule.metadata?.maxRedemptionPercentage as
      | number
      | undefined;
    if (maxRedemptionPercentage) {
      const maxDiscount = (orderValue * maxRedemptionPercentage) / 100;
      if (discountAmount > maxDiscount) {
        // Recalculate points needed for max discount
        const adjustedPoints = Math.floor(maxDiscount / rule.rupeesPerPoint);
        return {
          discountAmount: adjustedPoints * rule.rupeesPerPoint,
          pointsUsed: adjustedPoints,
        };
      }
    }

    return {
      discountAmount,
      pointsUsed: pointsToRedeem,
    };
  }

  /**
   * Get all rules (admin)
   */
  async getAllRules(options?: {
    type?: "earning" | "redemption";
    isActive?: boolean;
  }) {
    const conditions: SQL[] = [];

    if (options?.type) {
      conditions.push(eq(loyaltyRules.type, options.type));
    }

    if (options?.isActive !== undefined) {
      conditions.push(eq(loyaltyRules.isActive, options.isActive));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rules = await this.db
      .select()
      .from(loyaltyRules)
      .where(whereClause)
      .orderBy(loyaltyRules.createdAt);

    return rules.map((rule) => ({
      ...rule,
      maxPointsPerOrder: rule.maxPointsPerOrder ?? undefined,
      validUntil: rule.validUntil ?? undefined,
      customerGroupId: rule.customerGroupId ?? undefined,
      metadata: rule.metadata ?? undefined,
    }));
  }

  /**
   * Get rule by ID
   */
  async getRuleById(ruleId: string) {
    const [rule] = await this.db
      .select()
      .from(loyaltyRules)
      .where(eq(loyaltyRules.id, ruleId))
      .limit(1);

    if (!rule) {
      throw new NotFoundException("Loyalty rule not found");
    }

    return {
      ...rule,
      maxPointsPerOrder: rule.maxPointsPerOrder ?? undefined,
      validUntil: rule.validUntil ?? undefined,
      customerGroupId: rule.customerGroupId ?? undefined,
      metadata: rule.metadata ?? undefined,
    };
  }

  /**
   * Create a new loyalty rule
   */
  async createRule(data: {
    name: string;
    type: "earning" | "redemption";
    ruleType: "percentage" | "fixed" | "tiered";
    pointsPerRupee?: number;
    rupeesPerPoint?: number;
    minOrderValue?: number;
    minPointsToRedeem?: number;
    maxPointsPerOrder?: number;
    validFrom?: Date;
    validUntil?: Date;
    customerGroupId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const [rule] = await this.db
      .insert(loyaltyRules)
      .values({
        name: data.name,
        type: data.type,
        ruleType: data.ruleType,
        pointsPerRupee: data.pointsPerRupee || 0,
        rupeesPerPoint: data.rupeesPerPoint || 0,
        minOrderValue: data.minOrderValue || 0,
        minPointsToRedeem: data.minPointsToRedeem || 0,
        maxPointsPerOrder: data.maxPointsPerOrder || null,
        validFrom: data.validFrom || new Date(),
        validUntil: data.validUntil || null,
        customerGroupId: data.customerGroupId || null,
        metadata: data.metadata || null,
        isActive: true,
      })
      .returning();

    this.logger.info(
      createLogContext(this.contextService, "createRule", {
        ruleId: rule.id,
        name: data.name,
        type: data.type,
      }),
      "Loyalty rule created",
    );

    return {
      ...rule,
      maxPointsPerOrder: rule.maxPointsPerOrder ?? undefined,
      validUntil: rule.validUntil ?? undefined,
      customerGroupId: rule.customerGroupId ?? undefined,
      metadata: rule.metadata ?? undefined,
    };
  }

  /**
   * Update a loyalty rule
   */
  async updateRule(
    ruleId: string,
    data: Partial<{
      name: string;
      isActive: boolean;
      pointsPerRupee: number;
      rupeesPerPoint: number;
      minOrderValue: number;
      minPointsToRedeem: number;
      maxPointsPerOrder: number;
      validFrom: Date;
      validUntil: Date;
      customerGroupId: string;
      metadata: Record<string, unknown>;
    }>,
  ) {
    const [rule] = await this.db
      .update(loyaltyRules)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyRules.id, ruleId))
      .returning();

    if (!rule) {
      throw new NotFoundException("Loyalty rule not found");
    }

    this.logger.info(
      createLogContext(this.contextService, "updateRule", {
        ruleId,
      }),
      "Loyalty rule updated",
    );

    return {
      ...rule,
      maxPointsPerOrder: rule.maxPointsPerOrder ?? undefined,
      validUntil: rule.validUntil ?? undefined,
      customerGroupId: rule.customerGroupId ?? undefined,
      metadata: rule.metadata ?? undefined,
    };
  }

  /**
   * Delete a loyalty rule
   */
  async deleteRule(ruleId: string) {
    await this.db.delete(loyaltyRules).where(eq(loyaltyRules.id, ruleId));

    this.logger.info(
      createLogContext(this.contextService, "deleteRule", {
        ruleId,
      }),
      "Loyalty rule deleted",
    );
  }
}
