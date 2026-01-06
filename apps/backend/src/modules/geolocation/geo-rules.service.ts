import { Inject, Injectable } from "@nestjs/common";
import { geoRules } from "@vcecom/db";
import { desc, eq, sql } from "drizzle-orm";
import { DB_TOKEN } from "../database/database.constants";
import type { Database } from "../database/db";
import { GeoLocationDto } from "./dto/geo-location.dto";
import { GeoRuleAction } from "./dto/geo-rule.dto";

export interface GeoRuleCheckResult {
  isRestricted: boolean;
  action: GeoRuleAction | null;
  warningMessage: string | null;
  redirectUrl: string | null;
  matchedRuleId: string | null;
}

@Injectable()
export class GeoRulesService {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  /**
   * Check if a location is restricted based on geo rules
   */
  async checkLocation(
    location: GeoLocationDto | null,
  ): Promise<GeoRuleCheckResult> {
    if (!location) {
      return {
        isRestricted: false,
        action: null,
        warningMessage: null,
        redirectUrl: null,
        matchedRuleId: null,
      };
    }

    // Get all active geo rules, ordered by priority (highest first)
    const rules = await this.db
      .select()
      .from(geoRules)
      .where(eq(geoRules.isActive, true))
      .orderBy(desc(geoRules.priority));

    // Check each rule in priority order
    for (const rule of rules) {
      if (this.matchesRule(rule, location)) {
        const isRestricted = rule.type === "RESTRICTED";

        return {
          isRestricted,
          action: rule.action as GeoRuleAction,
          warningMessage: rule.warningMessage || null,
          redirectUrl: rule.redirectUrl || null,
          matchedRuleId: rule.id,
        };
      }
    }

    return {
      isRestricted: false,
      action: null,
      warningMessage: null,
      redirectUrl: null,
      matchedRuleId: null,
    };
  }

  /**
   * Check if a location matches a geo rule
   */
  private matchesRule(
    rule: typeof geoRules.$inferSelect,
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

    // If we have country or state filters and they matched, return true
    return true;
  }

  /**
   * Get all geo rules
   */
  async findAll(): Promise<(typeof geoRules.$inferSelect)[]> {
    return this.db.select().from(geoRules).orderBy(desc(geoRules.priority));
  }

  /**
   * Get a geo rule by ID
   */
  async findOne(id: string): Promise<typeof geoRules.$inferSelect | null> {
    const [rule] = await this.db
      .select()
      .from(geoRules)
      .where(eq(geoRules.id, id))
      .limit(1);

    return rule || null;
  }

  /**
   * Create a geo rule
   */
  async create(
    data: typeof geoRules.$inferInsert,
  ): Promise<typeof geoRules.$inferSelect> {
    const [rule] = await this.db
      .insert(geoRules)
      .values({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .returning();

    return rule;
  }

  /**
   * Update a geo rule
   */
  async update(
    id: string,
    data: Partial<typeof geoRules.$inferInsert>,
  ): Promise<typeof geoRules.$inferSelect | null> {
    const [rule] = await this.db
      .update(geoRules)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(geoRules.id, id))
      .returning();

    return rule || null;
  }

  /**
   * Delete a geo rule
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(geoRules).where(eq(geoRules.id, id));

    return (result.rowCount ?? 0) > 0;
  }
}
