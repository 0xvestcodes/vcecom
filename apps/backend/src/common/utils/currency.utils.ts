/**
 * Currency conversion utilities
 * Handles conversion between rupees and paise
 * Strategy: Store in paise, convert to rupees for display
 */

import { PAISE_PER_RUPEE } from "../constants/currency.constants";

/**
 * Convert rupees to paise
 * @param rupees - Amount in rupees
 * @returns Amount in paise (rounded to nearest integer)
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/**
 * Convert paise to rupees
 * @param paise - Amount in paise
 * @returns Amount in rupees (rounded to 2 decimal places)
 */
export function paiseToRupees(paise: number): number {
  return Math.round(paise) / PAISE_PER_RUPEE;
}

/**
 * Format paise as rupees string for display
 * @param paise - Amount in paise
 * @returns Formatted string (e.g., "₹1,234.56")
 */
export function formatPaiseAsRupees(paise: number): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}
