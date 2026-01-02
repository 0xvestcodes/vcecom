import { validateEnv, validateStorageProviderEnv } from "./env.validation";

/**
 * Configuration loader state
 */
let validated = false;

/**
 * Load and validate configuration
 * Ensures configuration is validated and loaded before application startup
 * This should be called in main.ts before NestJS bootstrap
 * @throws Error if validation fails
 */
export function loadConfig(): void {
  if (validated) {
    return;
  }

  try {
    // Validate environment variables
    const env = validateEnv();

    // Validate storage provider specific variables
    validateStorageProviderEnv(env);

    validated = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Configuration loading failed: ${errorMessage}`);
  }
}

/**
 * Check if configuration has been validated
 */
export function isConfigValidated(): boolean {
  return validated;
}

/**
 * Reset validation state (useful for testing)
 */
export function resetConfig(): void {
  validated = false;
}

/**
 * @deprecated Use loadConfig() instead
 * Configuration loader class (kept for backward compatibility)
 * Note: Static-only class kept for backward compatibility with existing code
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Backward compatibility - deprecated class
export class ConfigLoader {
  /**
   * @deprecated Use loadConfig() instead
   */
  static load(): void {
    loadConfig();
  }

  /**
   * @deprecated Use isConfigValidated() instead
   */
  static isValidated(): boolean {
    return isConfigValidated();
  }

  /**
   * @deprecated Use resetConfig() instead
   */
  static reset(): void {
    resetConfig();
  }
}
