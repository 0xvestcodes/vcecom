/**
 * Currency conversion constants
 * Used for all monetary calculations to avoid floating point errors
 */

/**
 * Multiplier to convert INR (rupees) to paise (smallest unit)
 * Used for all monetary calculations to avoid floating point errors
 * 1 rupee = 100 paise
 */
export const PAISE_PER_RUPEE = 100;

/**
 * Precision for rounding monetary values
 * Used when displaying currency values
 */
export const CURRENCY_DECIMAL_PLACES = 2;

/**
 * Minimum amount in paise (1 rupee)
 * Used for validation of minimum transaction amounts
 */
export const MIN_AMOUNT_PAISE = 100;

/**
 * Multiplier to convert decimal ratio to percentage
 * Used for percentage calculations: 0.5 * PERCENTAGE_MULTIPLIER = 50%
 */
export const PERCENTAGE_MULTIPLIER = 100;

/**
 * Multiplier for rounding to 2 decimal places
 * Used in rounding calculations: Math.round(value * DECIMAL_ROUNDING_MULTIPLIER) / DECIMAL_ROUNDING_MULTIPLIER
 */
export const DECIMAL_ROUNDING_MULTIPLIER = 100;
