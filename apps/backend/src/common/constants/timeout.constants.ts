/**
 * Timeout and delay constants
 * Used for retry operations, script loading, and async operations
 */

/**
 * Delay before retry operations in milliseconds
 * Allows transient errors to resolve before retrying
 */
export const RETRY_DELAY_MS = 500;

/**
 * Short delay for quick retries in milliseconds
 * Used for operations that may resolve quickly
 */
export const SHORT_RETRY_DELAY_MS = 200;

/**
 * Script load timeout in milliseconds
 * Maximum time to wait for Redis Lua scripts to load
 */
export const SCRIPT_LOAD_TIMEOUT_MS = 2000;

/**
 * Bootstrap timeout in milliseconds
 * Maximum time to wait for NestJS application initialization
 */
export const BOOTSTRAP_TIMEOUT_MS = 30000;

/**
 * Progress logging interval in milliseconds
 * How often to log progress during long-running operations
 */
export const PROGRESS_LOG_INTERVAL_MS = 2000;

/**
 * Interval for periodic cleanup tasks in milliseconds
 * Used for scheduled background jobs (e.g., reservation cleanup)
 */
export const CLEANUP_INTERVAL_MS = 30000;

/**
 * Multiplier to convert seconds to milliseconds
 * Used when converting TTL values from seconds (Redis) to milliseconds (JavaScript)
 */
export const SECONDS_TO_MILLISECONDS = 1000;
