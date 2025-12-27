// External libraries
import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  desc,
  eq,
  pincodes,
  shippingRules,
  shippingZoneRates,
  stateShippingRules,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { DEFAULT_SHIPPING_ZONE } from "../../common/constants";
// Internal modules - Common
import {
  checkPincodeServiceability,
  ServiceabilityResult,
} from "../../common/utils/pincode.utils";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";

// Relative imports
import {
  calculateExcessWeightCharges,
  calculateFinalShippingRate,
  getFallbackZoneRates,
  getStateRulesFromDatabase,
  getZoneRatesFromDatabase,
} from "./services/shipping-rate.helper";

export interface ShippingCalculation {
  baseRate: number;
  additionalCharges: number;
  codCharge?: number;
  totalRate: number;
  estimatedDays: number;
  isCodAvailable: boolean;
  zone: string;
}

export interface ShippingRateRequest {
  pincode: string;
  weight: number; // in grams
  isCod?: boolean;
}

@Injectable()
export class ShippingRulesService {
  constructor(
    private readonly logger: PinoLogger,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Check if a PIN code is serviceable and get shipping details
   */
  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    try {
      // First try to get data from database
      const pincodeData = await this.db
        .select({
          pincode: pincodes.pincode,
          state: pincodes.state,
          district: pincodes.district,
          city: pincodes.officeName,
          isServiceable: pincodes.isServiceable,
          codAvailable: pincodes.codAvailable,
          shippingZone: pincodes.shippingZone,
          estimatedDeliveryDays: pincodes.estimatedDeliveryDays,
        })
        .from(pincodes)
        .where(eq(pincodes.pincode, pincode))
        .limit(1);

      if (pincodeData.length > 0) {
        const data = pincodeData[0];
        return {
          isValid: true,
          isServiceable: data.isServiceable,
          codAvailable: data.codAvailable ?? false,
          shippingZone: data.shippingZone ?? DEFAULT_SHIPPING_ZONE,
          state: data.state,
          district: data.district,
          city: data.city,
        };
      }

      // Fallback to utility function if not in database
      this.logger.warn(
        `PIN code ${pincode} not found in database, using fallback logic`,
      );
      return await checkPincodeServiceability(pincode);
    } catch (error) {
      this.logger.error(
        `Error checking serviceability for PIN code ${pincode}:`,
        error,
      );
      // Fallback to utility function on error
      return await checkPincodeServiceability(pincode);
    }
  }

  /**
   * Calculate shipping rates based on PIN code and weight
   */
  async calculateShippingRate(
    request: ShippingRateRequest,
  ): Promise<ShippingCalculation> {
    const { pincode, weight, isCod = false } = request;

    // Check serviceability first
    const serviceability = await this.checkServiceability(pincode);

    if (!serviceability.isValid || !serviceability.isServiceable) {
      throw new Error(`PIN code ${pincode} is not serviceable`);
    }

    const zone = serviceability.shippingZone || "zone_c";

    // Get zone-based rates from database or fallback
    const zoneRateData = await getZoneRatesFromDatabase(this.db, zone);
    let baseRate: number;
    let estimatedDays: number;
    let codCharge: number | undefined;

    if (zoneRateData) {
      baseRate = zoneRateData.baseRate;
      estimatedDays = zoneRateData.estimatedDays;
      codCharge = zoneRateData.codCharge;

      // Calculate additional charges for excess weight
      if (zoneRateData.maxWeight) {
        const excessCharges = calculateExcessWeightCharges(
          weight,
          zoneRateData.maxWeight,
          zoneRateData.additionalPerKg,
        );
        baseRate += excessCharges;
      }
    } else {
      // Fallback to utility function
      const fallbackRates = getFallbackZoneRates(zone, weight);
      baseRate = fallbackRates.baseRate;
      estimatedDays = fallbackRates.estimatedDays;
    }

    // Apply state-specific rules
    const stateRuleData = await getStateRulesFromDatabase(
      this.db,
      serviceability.state,
    );
    let additionalDays = 0;
    let finalCodAvailable = serviceability.codAvailable ?? false;

    if (stateRuleData) {
      additionalDays = stateRuleData.additionalDays;
      if (isCod && stateRuleData.codCharge) {
        codCharge = stateRuleData.codCharge;
      }
      finalCodAvailable = stateRuleData.codAvailable;
    }

    // Calculate final rates
    const finalRates = calculateFinalShippingRate(
      baseRate,
      isCod,
      finalCodAvailable,
      codCharge,
    );

    return {
      baseRate: finalRates.baseRate,
      additionalCharges: 0, // Additional charges are already included in baseRate
      codCharge: finalRates.codChargeAmount,
      totalRate: finalRates.totalRate,
      estimatedDays: estimatedDays + additionalDays,
      isCodAvailable: finalCodAvailable,
      zone,
    };
  }

  // ============================================================================
  // Public API Methods - Configuration Retrieval
  // ============================================================================

  /**
   * Get all active shipping rules
   */
  async getShippingRules() {
    return await this.db
      .select()
      .from(shippingRules)
      .where(eq(shippingRules.isActive, true))
      .orderBy(desc(shippingRules.priority));
  }

  /**
   * Get shipping zone rates
   */
  async getShippingZoneRates() {
    return await this.db
      .select()
      .from(shippingZoneRates)
      .where(eq(shippingZoneRates.isActive, true))
      .orderBy(shippingZoneRates.zone, shippingZoneRates.minWeight);
  }

  /**
   * Get state shipping rules
   */
  async getStateShippingRules() {
    return await this.db
      .select()
      .from(stateShippingRules)
      .where(eq(stateShippingRules.isActive, true))
      .orderBy(stateShippingRules.state);
  }

  /**
   * Bulk check serviceability for multiple PIN codes
   */
  async checkBulkServiceability(
    pincodeList: string[],
  ): Promise<Map<string, ServiceabilityResult>> {
    const results = new Map<string, ServiceabilityResult>();

    // Get data from database first
    const dbResults = await this.db
      .select({
        pincode: pincodes.pincode,
        state: pincodes.state,
        district: pincodes.district,
        city: pincodes.officeName,
        isServiceable: pincodes.isServiceable,
        codAvailable: pincodes.codAvailable,
        shippingZone: pincodes.shippingZone,
      })
      .from(pincodes)
      .where(and(...pincodeList.map((pin) => eq(pincodes.pincode, pin))));

    // Create map of database results with proper typing
    const dbMap = new Map<
      string,
      {
        pincode: string;
        state: string | null;
        district: string | null;
        city: string | null;
        isServiceable: boolean;
        codAvailable: boolean;
        shippingZone: string;
      }
    >(dbResults.map((result) => [result.pincode, result]));

    // Process each PIN code
    for (const pincode of pincodeList) {
      if (dbMap.has(pincode)) {
        const data = dbMap.get(pincode);
        if (!data) continue;
        results.set(pincode, {
          isValid: true,
          isServiceable: data.isServiceable,
          codAvailable: data.codAvailable,
          shippingZone: data.shippingZone,
          state: data.state || undefined,
          district: data.district || undefined,
          city: data.city || undefined,
        });
      } else {
        // Fallback to utility function
        const result = await checkPincodeServiceability(pincode);
        results.set(pincode, result);
      }
    }

    return results;
  }

  // ============================================================================
  // Public API Methods - Validation & Utilities
  // ============================================================================

  /**
   * Validate PIN code format and basic rules
   */
  validatePincodeFormat(pincode: string): boolean {
    if (!pincode || typeof pincode !== "string") {
      return false;
    }

    const cleaned = pincode.trim().replace(/\s+/g, "");

    // Must be exactly 6 digits
    if (cleaned.length !== 6) {
      return false;
    }

    // Must be all digits
    const pincodePattern = /^\d{6}$/;
    return pincodePattern.test(cleaned);
  }

  /**
   * Get shipping zones available
   */
  getAvailableShippingZones(): string[] {
    return ["metro", "zone_a", "zone_b", "zone_c", "zone_d", "zone_e"];
  }
}
