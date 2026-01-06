/**
 * HSN (Harmonized System of Nomenclature) code validation
 * HSN codes are 8-digit numeric codes used for GST classification in India
 */

/**
 * HSN code format: 8-digit numeric code
 */
const HSN_CODE_REGEX = /^\d{8}$/;

/**
 * Validate HSN code format
 * @param hsnCode - HSN code to validate
 * @returns true if valid format, false otherwise
 */
export function validateHsnCodeFormat(hsnCode: string): boolean {
  if (!hsnCode || typeof hsnCode !== "string") {
    return false;
  }

  return HSN_CODE_REGEX.test(hsnCode.trim());
}

/**
 * Normalize HSN code (trim whitespace)
 * @param hsnCode - HSN code to normalize
 * @returns Normalized HSN code or null if invalid
 */
export function normalizeHsnCode(hsnCode: string): string | null {
  if (!hsnCode || typeof hsnCode !== "string") {
    return null;
  }

  const normalized = hsnCode.trim();

  if (!validateHsnCodeFormat(normalized)) {
    return null;
  }

  return normalized;
}
