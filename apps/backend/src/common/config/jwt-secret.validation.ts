/**
 * JWT Secret Validation
 * Ensures JWT secrets are properly configured and not using default values
 */

const DEFAULT_SECRET = "change-me-in-production";
const DEFAULT_REFRESH_SECRET = "change-me-refresh-in-production";

/**
 * Validate JWT secret
 * Throws an error if secret is missing, too short, or using default value
 * @param secret - The JWT secret to validate
 * @param secretName - Name of the secret for error messages
 * @throws Error if validation fails
 */
export function validateJwtSecret(
  secret: string | undefined,
  secretName: string = "JWT_SECRET",
): string {
  if (!secret) {
    throw new Error(
      `${secretName} must be set. Please set it to a secure random value (at least 32 characters).`,
    );
  }

  if (secret.length < 32) {
    throw new Error(
      `${secretName} must be at least 32 characters long. Current length: ${secret.length}`,
    );
  }

  if (secret === DEFAULT_SECRET || secret === DEFAULT_REFRESH_SECRET) {
    throw new Error(
      `${secretName} must not be the default value '${secret}'. Please set it to a secure random value in production.`,
    );
  }

  return secret;
}

/**
 * Get validated JWT secret from environment
 * Validates and returns JWT_SECRET from process.env
 */
export function getValidatedJwtSecret(): string {
  return validateJwtSecret(process.env.JWT_SECRET, "JWT_SECRET");
}

/**
 * Get validated JWT refresh secret from environment
 * Validates and returns JWT_REFRESH_SECRET from process.env
 * Falls back to JWT_SECRET if JWT_REFRESH_SECRET is not set
 */
export function getValidatedJwtRefreshSecret(): string {
  const refreshSecret =
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

  return validateJwtSecret(refreshSecret, "JWT_REFRESH_SECRET");
}
