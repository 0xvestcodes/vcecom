/**
 * Currency conversion utilities
 * Handles conversion between rupees and paise
 * Strategy: Store in paise, convert to rupees for display
 *
 * Note: For multi-currency support, use CurrencyConversionService
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

/**
 * Convert currency amount using exchange rate
 * Pure function - does not fetch rates, use CurrencyConversionService for that
 * @param amount - Amount to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @param rate - Exchange rate (1 fromCurrency = rate toCurrency)
 * @returns Converted amount
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }
  return amount * rate;
}

/**
 * Get smallest unit multiplier for a currency
 * e.g., 100 for INR (paise), 100 for USD (cents), 1 for JPY (no subunit)
 * @param currencyCode - Currency code
 * @returns Smallest unit multiplier (default: 100)
 */
export function getSmallestUnitMultiplier(currencyCode: string): number {
  // Most currencies use 100 (cents, paise, etc.)
  // Some like JPY use 1 (no subunit)
  // This is a simple implementation - CurrencyConversionService has more logic
  const noSubunitCurrencies = ["JPY", "KRW", "VND", "CLP"];
  return noSubunitCurrencies.includes(currencyCode.toUpperCase()) ? 1 : 100;
}
