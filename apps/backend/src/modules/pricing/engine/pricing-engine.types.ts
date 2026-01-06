/**
 * Pricing engine input types
 */

export interface VariantPricingInput {
  variantId: string;
  productId: string;
  categoryId: string | null;
  basePrice: number;
  compareAtPrice?: number;
  salePrice?: number;
  saleStartDate?: Date;
  saleEndDate?: Date;
  currency?: string; // Currency code for the variant's base price
}

export interface PriceListOverride {
  priceListId: string;
  priceListName: string;
  priority: number;
  overrideType: "FIXED" | "PERCENTAGE";
  overrideValue: number;
  specificity: "VARIANT" | "PRODUCT" | "CATEGORY"; // Most specific wins
}

export interface PriceList {
  id: string;
  name: string;
  type: string;
  priority: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  currency?: string | null; // Currency code (null = applies to all currencies)
  items: Array<{
    id: string;
    productVariantId?: string;
    productId?: string;
    categoryId?: string;
    currency?: string | null; // Currency code (null = applies to all currencies for this price list)
    overrideType: "FIXED" | "PERCENTAGE";
    overrideValue: number;
  }>;
}

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

export interface PricingEngineInput {
  variants: VariantPricingInput[];
  customer: {
    id: string;
    customerGroupId: string | null;
  } | null;
  priceLists: PriceList[]; // Pre-filtered for customer group and active status
  regionPricingRules?: RegionPricingRule[]; // Pre-filtered region pricing rules
  now: Date;
  targetCurrency?: string; // Target currency for price conversion (optional)
}

/**
 * Pricing engine output types
 */
export interface VariantPricingResult {
  variantId: string;
  basePrice: number;
  compareAtPrice?: number;
  effectivePrice: number;
  appliedPriceListId?: string;
  appliedPriceListName?: string;
  salePrice?: number;
  isOnSale: boolean;
  priceListOverrides: PriceListOverride[]; // All applicable overrides (for debugging)
}

export interface PricingEngineResult {
  variantPrices: VariantPricingResult[];
  totalBasePrice: number;
  totalEffectivePrice: number;
  totalSavings: number;
  appliedPriceListIds: string[];
}

/**
 * Bundle variant breakdown in pricing snapshot
 */
export interface BundleVariantPricingBreakdown {
  variantId: string;
  unitPrice: number;
  quantity: number;
}

/**
 * Bundle breakdown in pricing snapshot
 */
export interface BundlePricingBreakdown {
  bundleId: string;
  bundleLineId: string;
  unitBundlePrice: number;
  variantBreakdown: BundleVariantPricingBreakdown[];
}

/**
 * Pricing snapshot extends engine result with versioning and integrity metadata
 * This is the immutable snapshot stored at payment intent creation
 */
export interface PricingSnapshot extends PricingEngineResult {
  /**
   * Engine version used to compute this snapshot
   * Format: "pricing-engine-v1"
   */
  engineVersion: string;

  /**
   * Ruleset version used to compute this snapshot
   */
  rulesetVersion: number;

  /**
   * ISO timestamp when snapshot was computed
   */
  computedAt: string;

  /**
   * SHA-256 hash of price lists used in computation
   * Prevents price list changes during checkout
   */
  ruleHash: string;

  /**
   * Bundle breakdowns (if any bundles in cart)
   * Contains pricing breakdown for each bundle line item
   */
  bundleBreakdowns?: BundlePricingBreakdown[];
}
