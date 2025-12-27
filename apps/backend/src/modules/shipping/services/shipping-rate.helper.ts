import {
  and,
  desc,
  eq,
  gte,
  shippingZoneRates,
  stateShippingRules,
} from "@vcecom/db";
import {
  DEFAULT_FALLBACK_SHIPPING_RATE_INR,
  DEFAULT_SHIPPING_ZONE,
  ESTIMATED_DELIVERY_DAYS_BY_ZONE,
  GRAMS_PER_KILOGRAM,
} from "../../../common/constants";
import { getShippingRateByZone } from "../../../common/utils/pincode.utils";
import type { Database } from "../../../modules/database/db";

export interface ZoneRateData {
  baseRate: number;
  additionalPerKg: number;
  estimatedDays: number;
  codCharge?: number;
  maxWeight?: number | null;
}

export interface StateRuleData {
  additionalDays: number;
  codCharge?: number | null;
  codAvailable: boolean;
}

/**
 * Get zone-based shipping rates from database
 *
 * Returns the most applicable rate for the zone based on weight tiers
 * Rates are ordered by minWeight descending to find the highest tier that applies
 * Example: If weight is 1500g, we want the rate for "1000g+" not "500g+"
 */
export async function getZoneRatesFromDatabase(
  db: Database,
  zone: string,
): Promise<ZoneRateData | null> {
  const defaultZone = zone || DEFAULT_SHIPPING_ZONE;
  // Order by minWeight DESC to get highest applicable tier first
  // This ensures we match the correct weight tier (e.g., 1000g+ vs 500g+)
  const zoneRates = await db
    .select()
    .from(shippingZoneRates)
    .where(
      and(
        eq(shippingZoneRates.zone, defaultZone),
        eq(shippingZoneRates.isActive, true),
        gte(shippingZoneRates.minWeight, 0),
      ),
    )
    .orderBy(desc(shippingZoneRates.minWeight))
    .limit(1);

  if (zoneRates.length === 0) {
    return null;
  }

  const rate = zoneRates[0];
  return {
    baseRate: rate.baseRate,
    additionalPerKg: rate.additionalPerKg || 0,
    estimatedDays: rate.estimatedDays,
    codCharge: rate.codCharge ?? undefined,
    maxWeight: rate.maxWeight,
  };
}

/**
 * Get fallback zone rates when database rates are not available
 *
 * Used as a safety net when database doesn't have configured rates for a zone
 * Falls back to hardcoded rates in pincode.utils.ts
 * This ensures shipping calculation never fails due to missing configuration
 */
export function getFallbackZoneRates(
  zone: string,
  weight: number,
): ZoneRateData {
  const defaultZone = zone || DEFAULT_SHIPPING_ZONE;
  const baseRate =
    getShippingRateByZone(defaultZone, weight) ||
    DEFAULT_FALLBACK_SHIPPING_RATE_INR;
  const estimatedDays =
    ESTIMATED_DELIVERY_DAYS_BY_ZONE[defaultZone] ??
    ESTIMATED_DELIVERY_DAYS_BY_ZONE[DEFAULT_SHIPPING_ZONE];

  return {
    baseRate,
    additionalPerKg: 0,
    estimatedDays,
  };
}

/**
 * Calculate additional charges for excess weight
 *
 * When package exceeds the maxWeight for a shipping tier, additional charges apply
 * Charges are calculated per kilogram (rounded up) for the excess weight
 * Example: If base rate covers 2kg and package is 3.5kg, charge for 2kg excess (rounded up)
 */
export function calculateExcessWeightCharges(
  weight: number,
  maxWeight: number,
  additionalPerKg: number,
): number {
  if (weight <= maxWeight) {
    return 0;
  }

  const excessWeight = weight - maxWeight;
  // Round up to nearest kilogram for excess weight charges
  return Math.ceil(excessWeight / GRAMS_PER_KILOGRAM) * additionalPerKg;
}

/**
 * Get state-specific shipping rules from database
 */
export async function getStateRulesFromDatabase(
  db: Database,
  state: string | null | undefined,
): Promise<StateRuleData | null> {
  if (!state) {
    return null;
  }

  const stateRules = await db
    .select()
    .from(stateShippingRules)
    .where(
      and(
        eq(stateShippingRules.state, state),
        eq(stateShippingRules.isActive, true),
      ),
    )
    .limit(1);

  if (stateRules.length === 0) {
    return null;
  }

  const rule = stateRules[0];
  return {
    additionalDays: rule.additionalDays,
    codCharge: rule.codCharge ?? undefined,
    codAvailable: rule.codAvailable ?? true,
  };
}

/**
 * Calculate final shipping rate with all adjustments
 */
export function calculateFinalShippingRate(
  baseRate: number,
  isCod: boolean,
  codAvailable: boolean,
  codCharge?: number,
): {
  baseRate: number;
  codChargeAmount: number;
  totalRate: number;
} {
  const codChargeAmount = isCod && codAvailable && codCharge ? codCharge : 0;
  const totalRate = baseRate + codChargeAmount;

  return {
    baseRate,
    codChargeAmount,
    totalRate,
  };
}
