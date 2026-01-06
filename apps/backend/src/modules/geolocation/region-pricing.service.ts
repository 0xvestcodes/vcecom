import { Inject, Injectable } from "@nestjs/common";
import { regionPricingRules } from "@vcecom/db";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { DB_TOKEN } from "../database/database.constants";
import type { Database } from "../database/db";
import { GeoLocationDto } from "./dto/geo-location.dto";

export interface RegionPricingRule {
  id: string;
  type: "OVERRIDE" | "MARKUP";
  overrideType: "FIXED" | "PERCENTAGE";
  overrideValue: number;
  priority: number;
  productVariantId?: string | null;
  productId?: string | null;
  categoryId?: string | null;
}

@Injectable()
export class RegionPricingService {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  /**
   * Get applicable region pricing rules for a location and variant
   */
  async getApplicableRules(
    location: GeoLocationDto | null,
    variantId: string,
    productId: string,
    categoryId: string | null,
  ): Promise<RegionPricingRule[]> {
    if (!location) {
      return [];
    }

    const now = new Date();

    // Get all active rules that match the location
    const allRules = await this.db
      .select()
      .from(regionPricingRules)
      .where(
        and(
          eq(regionPricingRules.isActive, true),
          or(
            sql`${regionPricingRules.startDate} IS NULL`,
            sql`${regionPricingRules.startDate} <= ${now}`,
          ),
          or(
            sql`${regionPricingRules.endDate} IS NULL`,
            sql`${regionPricingRules.endDate} >= ${now}`,
          ),
        ),
      )
      .orderBy(desc(regionPricingRules.priority));

    // Filter rules that match location and variant/product/category
    const applicableRules: RegionPricingRule[] = [];

    for (const rule of allRules) {
      // Check if rule matches location
      if (!this.matchesLocation(rule, location)) {
        continue;
      }

      // Check if rule matches variant/product/category
      if (rule.productVariantId && rule.productVariantId !== variantId) {
        continue;
      }

      if (rule.productId && rule.productId !== productId) {
        continue;
      }

      if (rule.categoryId && rule.categoryId !== categoryId) {
        continue;
      }

      // If no specific variant/product/category, rule applies to all
      applicableRules.push({
        id: rule.id,
        type: rule.type as "OVERRIDE" | "MARKUP",
        overrideType: rule.overrideType as "FIXED" | "PERCENTAGE",
        overrideValue: rule.overrideValue,
        priority: rule.priority,
        productVariantId: rule.productVariantId || undefined,
        productId: rule.productId || undefined,
        categoryId: rule.categoryId || undefined,
      });
    }

    // Sort by specificity: variant > product > category > general
    applicableRules.sort((a, b) => {
      // First sort by priority (higher first)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      // Then by specificity
      const aSpecificity = this.getSpecificity(a);
      const bSpecificity = this.getSpecificity(b);
      return bSpecificity - aSpecificity;
    });

    return applicableRules;
  }

  /**
   * Check if a rule matches a location
   */
  private matchesLocation(
    rule: typeof regionPricingRules.$inferSelect,
    location: GeoLocationDto,
  ): boolean {
    // Check country match
    if (rule.countries && rule.countries.length > 0) {
      const countryMatches =
        location.countryCode &&
        rule.countries.some(
          (c) =>
            c.toLowerCase() === location.countryCode?.toLowerCase() ||
            c.toLowerCase() === location.country?.toLowerCase(),
        );

      if (!countryMatches) {
        return false;
      }
    }

    // Check state/region match
    if (rule.states && rule.states.length > 0) {
      const stateMatches =
        location.regionCode &&
        rule.states.some(
          (s) =>
            s.toLowerCase() === location.regionCode?.toLowerCase() ||
            s.toLowerCase() === location.region?.toLowerCase(),
        );

      if (!stateMatches) {
        return false;
      }
    }

    // If no countries or states specified, rule matches all locations
    if (
      (!rule.countries || rule.countries.length === 0) &&
      (!rule.states || rule.states.length === 0)
    ) {
      return true;
    }

    return true;
  }

  /**
   * Get specificity score (higher = more specific)
   */
  private getSpecificity(rule: RegionPricingRule): number {
    if (rule.productVariantId) return 3;
    if (rule.productId) return 2;
    if (rule.categoryId) return 1;
    return 0;
  }

  /**
   * Apply region pricing rules to a price
   */
  applyRegionPricing(basePrice: number, rules: RegionPricingRule[]): number {
    if (rules.length === 0) {
      return basePrice;
    }

    // Use the highest priority rule (first in sorted array)
    const rule = rules[0];

    if (rule.type === "OVERRIDE") {
      // Override: set price to overrideValue
      return Math.max(0, rule.overrideValue);
    } else if (rule.type === "MARKUP") {
      // Markup: apply percentage or fixed adjustment
      if (rule.overrideType === "PERCENTAGE") {
        return Math.max(0, basePrice * (1 + rule.overrideValue / 100));
      } else {
        // FIXED markup
        return Math.max(0, basePrice + rule.overrideValue);
      }
    }

    return basePrice;
  }

  /**
   * Get all region pricing rules
   */
  async findAll(): Promise<(typeof regionPricingRules.$inferSelect)[]> {
    return this.db
      .select()
      .from(regionPricingRules)
      .orderBy(desc(regionPricingRules.priority));
  }

  /**
   * Get a region pricing rule by ID
   */
  async findOne(
    id: string,
  ): Promise<typeof regionPricingRules.$inferSelect | null> {
    const [rule] = await this.db
      .select()
      .from(regionPricingRules)
      .where(eq(regionPricingRules.id, id))
      .limit(1);

    return rule || null;
  }

  /**
   * Create a region pricing rule
   */
  async create(
    data: typeof regionPricingRules.$inferInsert,
  ): Promise<typeof regionPricingRules.$inferSelect> {
    const [rule] = await this.db
      .insert(regionPricingRules)
      .values({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .returning();

    return rule;
  }

  /**
   * Update a region pricing rule
   */
  async update(
    id: string,
    data: Partial<typeof regionPricingRules.$inferInsert>,
  ): Promise<typeof regionPricingRules.$inferSelect | null> {
    const [rule] = await this.db
      .update(regionPricingRules)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(regionPricingRules.id, id))
      .returning();

    return rule || null;
  }

  /**
   * Delete a region pricing rule
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(regionPricingRules)
      .where(eq(regionPricingRules.id, id));

    return (result.rowCount ?? 0) > 0;
  }
}
