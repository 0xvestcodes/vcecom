import {
  calculateCgstSgst,
  calculateIgst,
  isIntraStateTransaction,
} from "../../../common/utils/gst.utils";
import {
  AppliedTaxExemption,
  AppliedTaxRule,
  TaxEngineInput,
  TaxEngineResult,
  VariantTaxInput,
  VariantTaxResult,
} from "./tax-engine.types";
import { resolveTaxExemption } from "./tax-exemption-resolver";
import { resolveTaxRule } from "./tax-rule-resolver";

/**
 * Round to 2 decimal places
 */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate tax for a single variant
 */
function calculateVariantTax(
  variant: VariantTaxInput,
  resolvedGstRate: number,
  isExempt: boolean,
  appliedTaxRule: AppliedTaxRule | null,
  appliedExemption: AppliedTaxExemption | null,
  sellerState: string,
  buyerState: string,
): VariantTaxResult {
  const baseAmount = variant.baseAmount * variant.quantity;
  const isIntraState = isIntraStateTransaction(sellerState, buyerState);

  // If exempt, no tax
  if (isExempt) {
    return {
      variantId: variant.variantId,
      baseAmount,
      quantity: variant.quantity,
      resolvedGstRate: 0,
      isExempt: true,
      appliedTaxRule: appliedTaxRule || undefined,
      appliedExemption: appliedExemption || undefined,
      taxAmount: 0,
      taxBreakdown: {
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalGst: 0,
      },
      amountWithTax: baseAmount,
      isIntraState,
    };
  }

  // Calculate tax breakdown
  let taxBreakdown: {
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
  };

  if (isIntraState) {
    const { cgst, sgst } = calculateCgstSgst(baseAmount, resolvedGstRate);
    taxBreakdown = {
      cgst: roundToTwoDecimals(cgst),
      sgst: roundToTwoDecimals(sgst),
      igst: 0,
      totalGst: roundToTwoDecimals(cgst + sgst),
    };
  } else {
    const igst = calculateIgst(baseAmount, resolvedGstRate);
    taxBreakdown = {
      cgst: 0,
      sgst: 0,
      igst: roundToTwoDecimals(igst),
      totalGst: roundToTwoDecimals(igst),
    };
  }

  const taxAmount = taxBreakdown.totalGst;
  const amountWithTax = roundToTwoDecimals(baseAmount + taxAmount);

  return {
    variantId: variant.variantId,
    baseAmount,
    quantity: variant.quantity,
    resolvedGstRate,
    isExempt: false,
    appliedTaxRule: appliedTaxRule || undefined,
    appliedExemption: undefined,
    taxAmount,
    taxBreakdown,
    amountWithTax,
    isIntraState,
  };
}

/**
 * Pure tax calculation engine
 *
 * This is a deterministic function: same input → same output.
 * Never touches DB/Redis - all data must be pre-fetched.
 *
 * **Tax resolution order:**
 * 1. Check for exemptions (exemptions override tax rules)
 * 2. Resolve tax rule (Customer Group > Customer > Category > Product > Variant)
 * 3. Use base GST rate from product if no rule applies
 * 4. Calculate CGST/SGST for intra-state, IGST for inter-state
 *
 * @param input - Tax engine input containing:
 *   - `variants`: Array of product variants with tax context
 *   - `customer`: Customer information (id, group, GSTIN)
 *   - `sellerState`: Seller's state
 *   - `buyerState`: Buyer's state
 *   - `taxRules`: Pre-filtered tax rules
 *   - `taxExemptions`: Pre-filtered tax exemptions
 *   - `now`: Current date for rule/exemption validation
 * @returns Tax calculation result with breakdown
 */
export function runTaxEngine(input: TaxEngineInput): TaxEngineResult {
  const {
    variants,
    customer,
    sellerState,
    buyerState,
    taxRules,
    taxExemptions,
    now,
  } = input;

  const variantTaxes: VariantTaxResult[] = [];
  let totalBaseAmount = 0;
  let totalTaxAmount = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  const appliedTaxRuleIds = new Set<string>();
  const appliedExemptionIds = new Set<string>();

  const customerId = customer?.id || null;
  const customerGroupId = customer?.customerGroupId || null;

  // Process each variant
  for (const variant of variants) {
    // Step 1: Check for exemptions (exemptions override tax rules)
    const appliedExemption = resolveTaxExemption(
      variant,
      customerId,
      customerGroupId,
      taxExemptions,
      now,
    );

    const isExempt = appliedExemption !== null;

    if (appliedExemption) {
      appliedExemptionIds.add(appliedExemption.exemptionId);
    }

    // Step 2: Resolve tax rule (if not exempt)
    let resolvedGstRate = variant.baseGstRate;
    let appliedTaxRule: AppliedTaxRule | null = null;

    if (!isExempt) {
      appliedTaxRule = resolveTaxRule(
        variant,
        customerId,
        customerGroupId,
        taxRules,
        now,
      );

      if (appliedTaxRule) {
        resolvedGstRate = appliedTaxRule.gstRate;
        appliedTaxRuleIds.add(appliedTaxRule.ruleId);
      }
    }

    // Step 3: Calculate tax for this variant
    const variantTax = calculateVariantTax(
      variant,
      resolvedGstRate,
      isExempt,
      appliedTaxRule,
      appliedExemption,
      sellerState,
      buyerState,
    );

    variantTaxes.push(variantTax);

    // Aggregate totals
    totalBaseAmount += variantTax.baseAmount;
    totalTaxAmount += variantTax.taxAmount;
    totalCgst += variantTax.taxBreakdown.cgst;
    totalSgst += variantTax.taxBreakdown.sgst;
    totalIgst += variantTax.taxBreakdown.igst;
  }

  const totalAmountWithTax = roundToTwoDecimals(
    totalBaseAmount + totalTaxAmount,
  );

  // Determine if transaction is intra-state (all variants should have same state)
  const isIntraState =
    variantTaxes.length > 0 ? variantTaxes[0].isIntraState : false;

  return {
    variantTaxes,
    totalBaseAmount: roundToTwoDecimals(totalBaseAmount),
    totalTaxAmount: roundToTwoDecimals(totalTaxAmount),
    totalAmountWithTax,
    taxBreakdown: {
      cgst: roundToTwoDecimals(totalCgst),
      sgst: roundToTwoDecimals(totalSgst),
      igst: roundToTwoDecimals(totalIgst),
      totalGst: roundToTwoDecimals(totalTaxAmount),
    },
    isIntraState,
    appliedTaxRuleIds: Array.from(appliedTaxRuleIds),
    appliedExemptionIds: Array.from(appliedExemptionIds),
  };
}
