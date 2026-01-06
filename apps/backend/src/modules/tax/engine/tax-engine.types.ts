/**
 * Tax engine input types
 * All data must be pre-fetched - engine never touches DB/Redis
 */

/**
 * Tax rule type - defines the level at which tax rule applies
 */
export type TaxRuleType =
  | "CUSTOMER_GROUP"
  | "CUSTOMER"
  | "CATEGORY"
  | "PRODUCT"
  | "VARIANT";

/**
 * Tax exemption type - defines the level at which exemption applies
 */
export type TaxExemptionType =
  | "CUSTOMER_GROUP"
  | "CUSTOMER"
  | "CATEGORY"
  | "PRODUCT"
  | "VARIANT";

/**
 * Tax display type - how tax is displayed to customer
 */
export type TaxDisplayType = "INCLUSIVE" | "EXCLUSIVE";

/**
 * Tax rule input for tax engine
 */
export interface TaxRuleInput {
  id: string;
  name: string;
  ruleType: TaxRuleType;
  entityId: string;
  gstRate: number;
  priority: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Tax exemption input for tax engine
 */
export interface TaxExemptionInput {
  id: string;
  name: string;
  exemptionType: TaxExemptionType;
  entityId: string;
  exemptionReason?: string;
  certificateNumber?: string;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Variant tax input - product variant with tax context
 */
export interface VariantTaxInput {
  variantId: string;
  productId: string;
  categoryId: string | null;
  hsnCode?: string;
  baseGstRate: number; // Default GST rate from product
  baseAmount: number; // Price before tax
  quantity: number;
}

/**
 * Tax engine input
 */
export interface TaxEngineInput {
  variants: VariantTaxInput[];
  customer: {
    id: string;
    customerGroupId: string | null;
    gstin?: string;
  } | null;
  customerGroup?: {
    id: string;
    taxDisplayType: TaxDisplayType;
  } | null;
  sellerState: string;
  buyerState: string;
  taxRules: TaxRuleInput[]; // Pre-filtered for active status and date ranges
  taxExemptions: TaxExemptionInput[]; // Pre-filtered for active status and date ranges
  now: Date;
}

/**
 * Applied tax rule - rule that was applied to a variant
 */
export interface AppliedTaxRule {
  ruleId: string;
  ruleName: string;
  ruleType: TaxRuleType;
  gstRate: number;
  priority: number;
  specificity: number; // 1 = CUSTOMER_GROUP, 2 = CUSTOMER, 3 = CATEGORY, 4 = PRODUCT, 5 = VARIANT
}

/**
 * Applied tax exemption - exemption that was applied to a variant
 */
export interface AppliedTaxExemption {
  exemptionId: string;
  exemptionName: string;
  exemptionType: TaxExemptionType;
  exemptionReason?: string;
  certificateNumber?: string;
}

/**
 * Tax calculation breakdown for a single variant
 */
export interface VariantTaxResult {
  variantId: string;
  baseAmount: number;
  quantity: number;
  resolvedGstRate: number;
  isExempt: boolean;
  appliedTaxRule?: AppliedTaxRule;
  appliedExemption?: AppliedTaxExemption;
  taxAmount: number;
  taxBreakdown: {
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
  };
  amountWithTax: number;
  isIntraState: boolean;
}

/**
 * Tax engine result
 */
export interface TaxEngineResult {
  variantTaxes: VariantTaxResult[];
  totalBaseAmount: number;
  totalTaxAmount: number;
  totalAmountWithTax: number;
  taxBreakdown: {
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
  };
  isIntraState: boolean;
  appliedTaxRuleIds: string[];
  appliedExemptionIds: string[];
}

/**
 * Tax snapshot extends engine result with versioning and integrity metadata
 * This is the immutable snapshot stored at payment intent creation
 */
export interface TaxSnapshot extends TaxEngineResult {
  /**
   * Engine version used to compute this snapshot
   * Format: "tax-engine-v1"
   */
  engineVersion: string;

  /**
   * ISO timestamp when snapshot was computed
   */
  computedAt: string;

  /**
   * SHA-256 hash of tax rules used in computation
   * Prevents tax rule changes during checkout
   */
  ruleHash: string;

  /**
   * Ruleset version used to compute this snapshot
   */
  rulesetVersion: number;
}
