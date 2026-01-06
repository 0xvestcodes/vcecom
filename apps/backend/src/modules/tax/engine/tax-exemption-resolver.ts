import {
  AppliedTaxExemption,
  TaxExemptionInput,
  TaxExemptionType,
  VariantTaxInput,
} from "./tax-engine.types";

/**
 * Get specificity score for tax exemption type
 * Higher score = more specific (wins in case of tie)
 * Same as tax rule specificity
 */
function getExemptionTypeSpecificity(exemptionType: TaxExemptionType): number {
  switch (exemptionType) {
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
 * Check if tax exemption matches variant context
 */
function exemptionMatchesVariant(
  exemption: TaxExemptionInput,
  variant: VariantTaxInput,
  customerId: string | null,
  customerGroupId: string | null,
): boolean {
  switch (exemption.exemptionType) {
    case "VARIANT":
      return exemption.entityId === variant.variantId;
    case "PRODUCT":
      return exemption.entityId === variant.productId;
    case "CATEGORY":
      return (
        variant.categoryId !== null && exemption.entityId === variant.categoryId
      );
    case "CUSTOMER":
      return customerId !== null && exemption.entityId === customerId;
    case "CUSTOMER_GROUP":
      return customerGroupId !== null && exemption.entityId === customerGroupId;
    default:
      return false;
  }
}

/**
 * Check if tax exemption is active at given date
 */
function isExemptionActive(exemption: TaxExemptionInput, now: Date): boolean {
  if (!exemption.isActive) {
    return false;
  }

  if (exemption.startDate && new Date(exemption.startDate) > now) {
    return false;
  }

  if (exemption.endDate && new Date(exemption.endDate) < now) {
    return false;
  }

  return true;
}

/**
 * Resolve tax exemption for a variant
 * If multiple exemptions match, the most specific one is returned
 */
export function resolveTaxExemption(
  variant: VariantTaxInput,
  customerId: string | null,
  customerGroupId: string | null,
  taxExemptions: TaxExemptionInput[],
  now: Date,
): AppliedTaxExemption | null {
  // Filter exemptions that match this variant and are active
  const matchingExemptions = taxExemptions
    .filter(
      (exemption) =>
        isExemptionActive(exemption, now) &&
        exemptionMatchesVariant(
          exemption,
          variant,
          customerId,
          customerGroupId,
        ),
    )
    .map((exemption) => ({
      ...exemption,
      specificity: getExemptionTypeSpecificity(exemption.exemptionType),
    }));

  if (matchingExemptions.length === 0) {
    return null;
  }

  // Sort by specificity (descending) - most specific exemption wins
  matchingExemptions.sort((a, b) => b.specificity - a.specificity);

  const bestExemption = matchingExemptions[0];

  return {
    exemptionId: bestExemption.id,
    exemptionName: bestExemption.name,
    exemptionType: bestExemption.exemptionType,
    exemptionReason: bestExemption.exemptionReason,
    certificateNumber: bestExemption.certificateNumber,
  };
}
