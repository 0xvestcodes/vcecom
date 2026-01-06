import {
  calculateEffectivePrice,
  calculatePriceAfterOverride,
} from "./pricing-calculation.helper";
import {
  PriceList,
  PriceListOverride,
  PricingEngineInput,
  PricingEngineResult,
  VariantPricingInput,
  VariantPricingResult,
} from "./pricing-engine.types";
import { validatePricingInput } from "./pricing-validator";

/**
 * Round to 2 decimal places
 */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Check if sale is active for a variant at the given date
 */
function isSaleActive(
  variant: VariantPricingInput,
  currentDate: Date,
): boolean {
  if (variant.salePrice === undefined) {
    return false;
  }

  if (variant.saleStartDate && new Date(variant.saleStartDate) > currentDate) {
    return false;
  }

  if (variant.saleEndDate && new Date(variant.saleEndDate) < currentDate) {
    return false;
  }

  return true;
}

/**
 * Resolve price list overrides for a variant
 *
 * Override priority (most specific wins):
 * 1. Variant-specific override (highest priority)
 * 2. Product-level override
 * 3. Category-level override (lowest priority)
 *
 * Currency filtering:
 * - Price list currency: null = applies to all currencies, specific code = only that currency
 * - Item currency: null = applies to all currencies for that price list, specific code = only that currency
 * - Variant currency: Used to match against price list/item currency filters
 *
 * Multiple price lists can apply, but only the most specific override from
 * the highest priority price list is used.
 */
function resolvePriceListOverrides(
  variant: VariantPricingInput,
  priceLists: PriceList[],
  targetCurrency?: string,
): PriceListOverride[] {
  const overrides: PriceListOverride[] = [];
  const variantCurrency = variant.currency || targetCurrency;

  for (const priceList of priceLists) {
    // Filter price list by currency (null = applies to all currencies)
    if (priceList.currency && priceList.currency !== variantCurrency) {
      continue;
    }

    for (const item of priceList.items) {
      // Filter item by currency (null = applies to all currencies for this price list)
      if (item.currency && item.currency !== variantCurrency) {
        continue;
      }
      // Variant-specific override takes precedence (most specific match)
      if (item.productVariantId === variant.variantId) {
        overrides.push({
          priceListId: priceList.id,
          priceListName: priceList.name,
          priority: priceList.priority,
          overrideType: item.overrideType,
          overrideValue: item.overrideValue,
          specificity: "VARIANT",
        });
        continue;
      }

      // Product-level override (less specific than variant, but more than category)
      if (item.productId === variant.productId) {
        overrides.push({
          priceListId: priceList.id,
          priceListName: priceList.name,
          priority: priceList.priority,
          overrideType: item.overrideType,
          overrideValue: item.overrideValue,
          specificity: "PRODUCT",
        });
        continue;
      }

      // Category-level override (least specific - applies to all variants in category)
      if (
        item.categoryId &&
        variant.categoryId &&
        item.categoryId === variant.categoryId
      ) {
        overrides.push({
          priceListId: priceList.id,
          priceListName: priceList.name,
          priority: priceList.priority,
          overrideType: item.overrideType,
          overrideValue: item.overrideValue,
          specificity: "CATEGORY",
        });
      }
    }
  }

  return overrides;
}

/**
 * Pure pricing engine
 *
 * This is a deterministic function: same input → same output.
 * Never touches DB/Redis - all data must be pre-fetched.
 *
 * **Price calculation order:**
 * 1. Base price (from product variant)
 * 2. Price list override (customer-specific pricing)
 * 3. Sale price (if active and scheduled)
 *
 * Sale price takes precedence over price list overrides when active.
 * This ensures promotional sales are always honored, even for VIP customers.
 *
 * @param input - Pricing engine input containing:
 *   - `variants`: Array of product variants with base prices
 *   - `priceLists`: Customer-specific price lists with overrides
 *   - `now`: Current date for sale price validation
 * @returns Pricing result with:
 *   - `variantPrices`: Calculated prices for each variant
 *   - `totalBasePrice`: Sum of all base prices
 *   - `totalEffectivePrice`: Sum of all effective prices (after overrides/sales)
 *   - `totalSavings`: Difference between base and effective prices
 *   - `appliedPriceListIds`: IDs of price lists that were applied
 *
 * @example
 * ```typescript
 * const result = runPricingEngine({
 *   variants: [
 *     {
 *       variantId: "v1",
 *       productId: "p1",
 *       basePrice: 100,
 *       salePrice: 80,
 *       saleStartDate: new Date("2024-01-01"),
 *       saleEndDate: new Date("2024-12-31"),
 *     },
 *   ],
 *   priceLists: [
 *     {
 *       id: "pl1",
 *       name: "VIP Customers",
 *       priority: 1,
 *       items: [
 *         {
 *           productVariantId: "v1",
 *           overrideType: "PERCENTAGE",
 *           overrideValue: 20, // 20% off
 *         },
 *       ],
 *     },
 *   ],
 *   now: new Date("2024-06-01"),
 * });
 * // Sale price (80) takes precedence over price list override
 * ```
 */
export function runPricingEngine(
  input: PricingEngineInput,
): PricingEngineResult {
  // Filter out invalid variants (missing required fields)
  const validVariants = validatePricingInput(input);
  const { priceLists, now: currentDate, targetCurrency } = input;

  const variantPrices: VariantPricingResult[] = [];
  let totalBasePrice = 0;
  let totalEffectivePrice = 0;
  const appliedPriceListIds = new Set<string>();

  // Process each variant independently
  for (const variant of validVariants) {
    // Resolve price list overrides (most specific match wins)
    // Overrides are sorted by specificity: variant > product > category
    // Currency filtering is applied within resolvePriceListOverrides
    const overrides = resolvePriceListOverrides(
      variant,
      priceLists,
      targetCurrency,
    );
    const bestOverride = overrides.length > 0 ? overrides[0] : null;

    // Calculate price after applying price list override
    // Override can be FIXED (set price) or PERCENTAGE (discount from base)
    const priceAfterOverride = calculatePriceAfterOverride(
      variant.basePrice,
      bestOverride,
    );

    if (bestOverride) {
      appliedPriceListIds.add(bestOverride.priceListId);
    }

    // Check if sale is active (within start/end date range)
    // Sale price takes precedence over price list overrides when active
    const saleActive = isSaleActive(variant, currentDate);
    let priceAfterSale = calculateEffectivePrice(
      variant.basePrice,
      priceAfterOverride,
      variant.salePrice,
      saleActive,
    );

    // Apply region pricing rules (after sale price but can override)
    // Region pricing rules are applied after price lists and sale prices
    if (input.regionPricingRules && input.regionPricingRules.length > 0) {
      const applicableRegionRules = input.regionPricingRules.filter((rule) => {
        // Check if rule applies to this variant
        if (
          rule.productVariantId &&
          rule.productVariantId !== variant.variantId
        ) {
          return false;
        }
        if (rule.productId && rule.productId !== variant.productId) {
          return false;
        }
        if (rule.categoryId && rule.categoryId !== variant.categoryId) {
          return false;
        }
        // If no specific variant/product/category, rule applies to all
        return true;
      });

      if (applicableRegionRules.length > 0) {
        // Sort by priority (highest first), then by specificity
        applicableRegionRules.sort((a, b) => {
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          // Specificity: variant > product > category
          const aSpec = a.productVariantId
            ? 3
            : a.productId
              ? 2
              : a.categoryId
                ? 1
                : 0;
          const bSpec = b.productVariantId
            ? 3
            : b.productId
              ? 2
              : b.categoryId
                ? 1
                : 0;
          return bSpec - aSpec;
        });

        const bestRule = applicableRegionRules[0];
        if (bestRule.type === "OVERRIDE") {
          // Override: set price to overrideValue
          priceAfterSale = roundToTwoDecimals(
            Math.max(0, bestRule.overrideValue),
          );
        } else if (bestRule.type === "MARKUP") {
          // Markup: apply percentage or fixed adjustment
          if (bestRule.overrideType === "PERCENTAGE") {
            priceAfterSale = roundToTwoDecimals(
              Math.max(0, priceAfterSale * (1 + bestRule.overrideValue / 100)),
            );
          } else {
            // FIXED markup
            priceAfterSale = roundToTwoDecimals(
              Math.max(0, priceAfterSale + bestRule.overrideValue),
            );
          }
        }
      }
    }

    const effectivePrice = priceAfterSale;

    // Build result with all pricing information for transparency
    variantPrices.push({
      variantId: variant.variantId,
      basePrice: variant.basePrice,
      compareAtPrice: variant.compareAtPrice,
      effectivePrice,
      appliedPriceListId: bestOverride?.priceListId,
      appliedPriceListName: bestOverride?.priceListName,
      salePrice: saleActive ? variant.salePrice : undefined,
      isOnSale: saleActive,
      priceListOverrides: overrides,
    });

    totalBasePrice += variant.basePrice;
    totalEffectivePrice += effectivePrice;
  }

  const totalSavings = totalBasePrice - totalEffectivePrice;

  return {
    variantPrices,
    totalBasePrice: roundToTwoDecimals(totalBasePrice),
    totalEffectivePrice: roundToTwoDecimals(totalEffectivePrice),
    totalSavings: roundToTwoDecimals(totalSavings),
    appliedPriceListIds: Array.from(appliedPriceListIds),
  };
}
