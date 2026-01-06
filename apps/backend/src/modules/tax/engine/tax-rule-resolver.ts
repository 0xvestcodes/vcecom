import {
  AppliedTaxRule,
  TaxRuleInput,
  TaxRuleType,
  VariantTaxInput,
} from "./tax-engine.types";

/**
 * Get specificity score for tax rule type
 * Higher score = more specific (wins in case of tie on priority)
 * 1 = CUSTOMER_GROUP (least specific)
 * 2 = CUSTOMER
 * 3 = CATEGORY
 * 4 = PRODUCT
 * 5 = VARIANT (most specific)
 */
function getRuleTypeSpecificity(ruleType: TaxRuleType): number {
  switch (ruleType) {
    case "CUSTOMER_GROUP":
      return 1;
    case "CUSTOMER":
      return 2;
    case "CATEGORY":
      return 3;
    case "PRODUCT":
      return 4;
    case "VARIANT":
      return 5;
    default:
      return 0;
  }
}

/**
 * Check if tax rule matches variant context
 */
function ruleMatchesVariant(
  rule: TaxRuleInput,
  variant: VariantTaxInput,
  customerId: string | null,
  customerGroupId: string | null,
): boolean {
  switch (rule.ruleType) {
    case "VARIANT":
      return rule.entityId === variant.variantId;
    case "PRODUCT":
      return rule.entityId === variant.productId;
    case "CATEGORY":
      return (
        variant.categoryId !== null && rule.entityId === variant.categoryId
      );
    case "CUSTOMER":
      return customerId !== null && rule.entityId === customerId;
    case "CUSTOMER_GROUP":
      return customerGroupId !== null && rule.entityId === customerGroupId;
    default:
      return false;
  }
}

/**
 * Check if tax rule is active at given date
 */
function isRuleActive(rule: TaxRuleInput, now: Date): boolean {
  if (!rule.isActive) {
    return false;
  }

  if (rule.startDate && new Date(rule.startDate) > now) {
    return false;
  }

  if (rule.endDate && new Date(rule.endDate) < now) {
    return false;
  }

  return true;
}

/**
 * Resolve tax rule for a variant
 * Priority: Most specific rule type wins. If same specificity, lower priority number wins.
 *
 * Resolution order:
 * 1. Variant-specific rule (most specific)
 * 2. Product-level rule
 * 3. Category-level rule
 * 4. Customer-specific rule
 * 5. Customer group rule (least specific)
 *
 * Within same specificity level, lower priority number = higher priority
 */
export function resolveTaxRule(
  variant: VariantTaxInput,
  customerId: string | null,
  customerGroupId: string | null,
  taxRules: TaxRuleInput[],
  now: Date,
): AppliedTaxRule | null {
  // Filter rules that match this variant and are active
  const matchingRules = taxRules
    .filter(
      (rule) =>
        isRuleActive(rule, now) &&
        ruleMatchesVariant(rule, variant, customerId, customerGroupId),
    )
    .map((rule) => ({
      ...rule,
      specificity: getRuleTypeSpecificity(rule.ruleType),
    }));

  if (matchingRules.length === 0) {
    return null;
  }

  // Sort by specificity (descending) then by priority (ascending)
  // Most specific rule wins, and within same specificity, lower priority number wins
  matchingRules.sort((a, b) => {
    if (a.specificity !== b.specificity) {
      return b.specificity - a.specificity; // Higher specificity first
    }
    return a.priority - b.priority; // Lower priority number first
  });

  const bestRule = matchingRules[0];

  return {
    ruleId: bestRule.id,
    ruleName: bestRule.name,
    ruleType: bestRule.ruleType,
    gstRate: bestRule.gstRate,
    priority: bestRule.priority,
    specificity: bestRule.specificity,
  };
}
