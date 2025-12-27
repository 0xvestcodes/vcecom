import { and, discountUsages, eq } from "@vcecom/db";
import type { Database } from "../../../modules/database/db";
import { DiscountResponseDto } from "../dto/discount-response.dto";

/**
 * Helper functions for discount eligibility checking
 * Extracted to improve readability and maintainability
 */

/**
 * Check if discount has reached its usage limit
 */
export function hasReachedUsageLimit(discount: DiscountResponseDto): boolean {
  if (!discount.usageLimit) {
    return false;
  }

  return discount.usageCount >= discount.usageLimit;
}

/**
 * Check if cart subtotal meets minimum order amount requirement
 */
export function meetsMinimumOrderAmount(
  discount: DiscountResponseDto,
  cartSubtotal: number,
): boolean {
  if (!discount.minOrderAmount) {
    return true;
  }

  return cartSubtotal >= discount.minOrderAmount;
}

/**
 * Check if user has reached per-user usage limit
 */
export async function hasReachedPerUserLimit(
  discount: DiscountResponseDto,
  userId: string,
  db: Database, // Accept db as parameter instead of importing directly
): Promise<boolean> {
  if (!discount.perUserLimit || !userId) {
    return false;
  }

  const userUsages = await db
    .select()
    .from(discountUsages)
    .where(
      and(
        eq(discountUsages.discountId, discount.id),
        eq(discountUsages.userId, userId),
      ),
    );

  return userUsages.length >= discount.perUserLimit;
}

/**
 * Check if discount passes all eligibility constraints
 *
 * All constraints must pass for discount to be eligible:
 * 1. Global usage limit not exceeded
 * 2. Cart meets minimum order amount
 * 3. User hasn't exceeded per-user limit (if applicable)
 *
 * Returns false if any constraint fails, true only if all pass
 */
export async function passesEligibilityConstraints(
  discount: DiscountResponseDto,
  cartSubtotal: number,
  userId: string | undefined,
  db: Database, // Accept db as parameter instead of importing directly
): Promise<boolean> {
  // Check global usage limit (total times discount can be used)
  if (hasReachedUsageLimit(discount)) {
    return false;
  }

  // Check minimum order amount requirement
  if (!meetsMinimumOrderAmount(discount, cartSubtotal)) {
    return false;
  }

  // Check per-user limit (how many times this user can use the discount)
  // Only checked if userId is provided (authenticated users)
  if (userId && (await hasReachedPerUserLimit(discount, userId, db))) {
    return false;
  }

  return true;
}

/**
 * Check if discount is already in the eligible list (avoid duplicates)
 */
export function isDiscountAlreadyInList(
  discountId: string,
  eligibleList: DiscountResponseDto[],
): boolean {
  return eligibleList.some((d) => d.id === discountId);
}
