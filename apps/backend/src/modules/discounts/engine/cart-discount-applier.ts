import { calculateDiscountAmount } from "../../../common/utils/discount.utils";
import {
  DiscountAppliesTo,
  DiscountScope,
  DiscountType,
} from "../dto/create-discount.dto";
import { DiscountResponseDto } from "../dto/discount-response.dto";
import { AppliedCartDiscount } from "./discount-engine.types";
import { ensureNonNegative, roundToTwoDecimals } from "./rounding.utils";

/**
 * Apply cart-level discounts to subtotal
 * Cart discounts are applied AFTER product-level and tiered/BOGO discounts
 * Separates discounts by appliesTo (SUBTOTAL vs TOTAL)
 */
export function applyCartDiscounts(
  subtotal: number,
  discounts: DiscountResponseDto[],
  shippingCost: number = 0,
): {
  subtotalDiscounts: AppliedCartDiscount[];
  totalDiscounts: AppliedCartDiscount[];
  subtotalAfterCartDiscounts: number;
  totalAfterDiscounts: number;
} {
  // Filter to only cart-level discounts
  const cartDiscounts = discounts.filter(
    (d) =>
      (d.scope === DiscountScope.ORDER || d.type === DiscountType.CART_LEVEL) &&
      d.type !== DiscountType.BUY_X_GET_Y &&
      d.type !== DiscountType.TIERED,
  );

  // Separate discounts by appliesTo
  const subtotalDiscounts = cartDiscounts.filter(
    (d) => d.appliesTo === DiscountAppliesTo.SUBTOTAL,
  );
  const totalDiscounts = cartDiscounts.filter(
    (d) => d.appliesTo === DiscountAppliesTo.TOTAL,
  );

  // Apply SUBTOTAL discounts first
  const subtotalAfterSubtotalDiscounts = applyDiscountsToAmount(
    subtotal,
    subtotalDiscounts,
  );

  // Add shipping to get total
  const totalBeforeDiscounts = subtotalAfterSubtotalDiscounts + shippingCost;

  // Apply TOTAL discounts to total (after shipping)
  const totalAfterTotalDiscounts = applyDiscountsToAmount(
    totalBeforeDiscounts,
    totalDiscounts,
  );

  return {
    subtotalDiscounts: subtotalDiscounts
      .map((d) => ({
        discountId: d.id,
        discountCode: d.code,
        discountAmount: calculateDiscountAmount(d, subtotal),
        discountType: d.type,
      }))
      .filter((d) => d.discountAmount > 0),
    totalDiscounts: totalDiscounts
      .map((d) => ({
        discountId: d.id,
        discountCode: d.code,
        discountAmount: calculateDiscountAmount(d, totalBeforeDiscounts),
        discountType: d.type,
      }))
      .filter((d) => d.discountAmount > 0),
    subtotalAfterCartDiscounts: roundToTwoDecimals(
      subtotalAfterSubtotalDiscounts,
    ),
    totalAfterDiscounts: roundToTwoDecimals(totalAfterTotalDiscounts),
  };
}

/**
 * Apply discounts to an amount
 */
function applyDiscountsToAmount(
  amount: number,
  discounts: DiscountResponseDto[],
): number {
  if (discounts.length === 0) {
    return amount;
  }

  // Sort by priority (ascending: lower = stronger)
  const sortedDiscounts = [...discounts].sort(
    (a, b) => a.priority - b.priority,
  );

  // Group by stacking compatibility
  const stackableDiscounts: DiscountResponseDto[] = [];
  const nonStackableDiscounts: DiscountResponseDto[] = [];

  for (const discount of sortedDiscounts) {
    if (discount.canStack) {
      stackableDiscounts.push(discount);
    } else {
      nonStackableDiscounts.push(discount);
    }
  }

  let currentAmount = amount;

  // Apply non-stackable discount (highest priority only)
  if (nonStackableDiscounts.length > 0) {
    const highestPriority = nonStackableDiscounts.reduce((prev, curr) =>
      prev.priority < curr.priority ? prev : curr,
    );
    const discountAmount = calculateDiscountAmount(
      highestPriority,
      currentAmount,
    );
    const roundedDiscount = roundToTwoDecimals(discountAmount);
    currentAmount = ensureNonNegative(currentAmount - roundedDiscount);
  }

  // Apply stackable discounts (all eligible)
  for (const discount of stackableDiscounts) {
    const discountAmount = calculateDiscountAmount(discount, currentAmount);
    const roundedDiscount = roundToTwoDecimals(discountAmount);
    currentAmount = ensureNonNegative(currentAmount - roundedDiscount);
  }

  return roundToTwoDecimals(currentAmount);
}
