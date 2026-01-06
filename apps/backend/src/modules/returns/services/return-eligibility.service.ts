import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  orderItems,
  orders,
  products,
  productVariants,
  returnEligibilityRules,
  returnRequests,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";

export interface ReturnEligibilityResult {
  eligible: boolean;
  reasons: string[];
  ruleId?: string;
  ruleName?: string;
}

export interface CheckEligibilityParams {
  orderId: string;
  customerId: string;
  returnReason: string;
  orderItemIds?: string[]; // Specific items being returned
}

@Injectable()
export class ReturnEligibilityService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Check if an order is eligible for return
   * @param params - Eligibility check parameters
   * @returns Eligibility result with reasons
   */
  async checkEligibility(
    params: CheckEligibilityParams,
  ): Promise<ReturnEligibilityResult> {
    const { orderId, customerId, returnReason, orderItemIds } = params;

    // Get order
    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Get all enabled eligibility rules, ordered by priority (highest first)
    const rules = await this.db
      .select()
      .from(returnEligibilityRules)
      .where(eq(returnEligibilityRules.enabled, true))
      .orderBy(desc(returnEligibilityRules.priority));

    // If no rules exist, default to eligible
    if (rules.length === 0) {
      this.logger.warn(
        createLogContext(this.contextService, "checkEligibility", {
          orderId,
          customerId,
        }),
        "No eligibility rules found, defaulting to eligible",
      );
      return {
        eligible: true,
        reasons: ["No eligibility rules configured"],
      };
    }

    // Check each rule (first matching rule wins)
    for (const rule of rules) {
      const result = await this.checkRule(order, rule, {
        returnReason,
        orderItemIds,
      });

      if (result.checked) {
        return {
          eligible: result.eligible,
          reasons: result.reasons,
          ruleId: rule.id,
          ruleName: rule.name,
        };
      }
    }

    // If no rule matched, default to eligible
    return {
      eligible: true,
      reasons: ["No matching eligibility rule found"],
    };
  }

  /**
   * Check a specific eligibility rule
   */
  private async checkRule(
    order: typeof orders.$inferSelect,
    rule: typeof returnEligibilityRules.$inferSelect,
    params: {
      returnReason: string;
      orderItemIds?: string[];
    },
  ): Promise<{
    checked: boolean;
    eligible: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let checked = false;

    // Check order status - must be delivered
    if (order.status !== "delivered") {
      return {
        checked: false,
        eligible: false,
        reasons: ["Order must be delivered to be eligible for return"],
      };
    }

    // Check max days after delivery
    if (rule.maxDaysAfterDelivery !== null) {
      const deliveryDate = await this.getDeliveryDate(order.id);
      if (deliveryDate) {
        const daysSinceDelivery = Math.floor(
          (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceDelivery > rule.maxDaysAfterDelivery) {
          checked = true;
          reasons.push(
            `Return window expired. Maximum ${rule.maxDaysAfterDelivery} days after delivery allowed.`,
          );
          return {
            checked,
            eligible: false,
            reasons,
          };
        }
      }
    }

    // Check allowed reasons
    if (rule.allowedReasons) {
      const allowedReasons = rule.allowedReasons as string[];
      if (
        allowedReasons.length > 0 &&
        !allowedReasons.includes(params.returnReason)
      ) {
        checked = true;
        reasons.push(`Return reason '${params.returnReason}' is not allowed`);
        return {
          checked,
          eligible: false,
          reasons,
        };
      }
    }

    // Check min order value
    if (rule.minOrderValue !== null && order.total < rule.minOrderValue) {
      checked = true;
      reasons.push(
        `Order value (₹${order.total}) is below minimum required (₹${rule.minOrderValue})`,
      );
      return {
        checked,
        eligible: false,
        reasons,
      };
    }

    // Check excluded products/categories
    if (params.orderItemIds && params.orderItemIds.length > 0) {
      const excludedCheck = await this.checkExcludedItems(
        params.orderItemIds,
        rule,
      );
      if (!excludedCheck.eligible) {
        checked = true;
        return {
          checked,
          eligible: false,
          reasons: excludedCheck.reasons,
        };
      }
    }

    // Check max returns per customer
    if (rule.maxReturnsPerCustomer !== null) {
      const customerReturnCount = await this.getCustomerReturnCount(
        order.customerId,
        rule.conditions as Record<string, unknown> | null,
      );

      if (customerReturnCount >= rule.maxReturnsPerCustomer) {
        checked = true;
        reasons.push(
          `Customer has exceeded maximum returns limit (${rule.maxReturnsPerCustomer})`,
        );
        return {
          checked,
          eligible: false,
          reasons,
        };
      }
    }

    // Rule passed all checks
    if (checked) {
      return {
        checked: true,
        eligible: true,
        reasons: ["Order meets all eligibility requirements"],
      };
    }

    // Rule didn't match (conditions not met)
    return {
      checked: false,
      eligible: true,
      reasons: [],
    };
  }

  /**
   * Check if items are excluded
   */
  private async checkExcludedItems(
    orderItemIds: string[],
    rule: typeof returnEligibilityRules.$inferSelect,
  ): Promise<{ eligible: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    // Get order items with product data
    const items = await this.db
      .select({
        orderItemId: orderItems.id,
        productId: products.id,
        categoryId: products.categoryId,
      })
      .from(orderItems)
      .innerJoin(
        productVariants,
        eq(orderItems.productVariantId, productVariants.id),
      )
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(inArray(orderItems.id, orderItemIds));

    const excludedProducts = (rule.excludedProducts as string[]) || [];
    const excludedCategories = (rule.excludedCategories as string[]) || [];

    for (const item of items) {
      if (excludedProducts.includes(item.productId)) {
        reasons.push(`Product ${item.productId} is excluded from returns`);
        return { eligible: false, reasons };
      }

      if (item.categoryId && excludedCategories.includes(item.categoryId)) {
        reasons.push(`Category ${item.categoryId} is excluded from returns`);
        return { eligible: false, reasons };
      }
    }

    return { eligible: true, reasons: [] };
  }

  /**
   * Get delivery date for order
   */
  private async getDeliveryDate(orderId: string): Promise<Date | null> {
    // Check order timeline for delivery event
    // For now, we'll check if order status is delivered and use updatedAt as proxy
    // In a full implementation, you'd query the timeline table
    const [order] = await this.db
      .select({ updatedAt: orders.updatedAt, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (order?.status === "delivered") {
      return order.updatedAt;
    }

    return null;
  }

  /**
   * Get customer return count within time period
   */
  private async getCustomerReturnCount(
    customerId: string,
    conditions: Record<string, unknown> | null,
  ): Promise<number> {
    // Get time period from conditions (e.g., last 30 days, last year)
    const timePeriodDays = (conditions?.timePeriodDays as number) || 365; // Default to 1 year

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timePeriodDays);

    const returnCount = await this.db
      .select({ count: returnRequests.id })
      .from(returnRequests)
      .where(
        and(
          eq(returnRequests.customerId, customerId),
          gte(returnRequests.requestedAt, cutoffDate),
        ),
      );

    return returnCount.length;
  }
}
