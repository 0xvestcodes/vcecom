/**
 * CMS Cache Constants
 *
 * These constants define cache TTLs and hydration limits for the CMS module.
 */

/**
 * Cache TTL for individual entries (1 hour)
 * Entries are invalidated on update, so this TTL is a safety net
 */
export const CMS_CACHE_TTL_ENTRY_SECONDS = 3600;

/**
 * Cache TTL for entry lists (30 minutes)
 * Lists are invalidated when entries are updated, so this TTL is a safety net
 */
export const CMS_CACHE_TTL_LIST_SECONDS = 1800;

/**
 * Cache TTL for content types (24 hours)
 * Content types change infrequently, so longer TTL is appropriate
 */
export const CMS_CACHE_TTL_CONTENT_TYPE_SECONDS = 86400;

/**
 * Delay before starting cache hydration on module init (5 seconds)
 * Allows other critical services to initialize first and prevents connection pool saturation
 */
export const CMS_CACHE_HYDRATION_DELAY_MS = 5000;

/**
 * Maximum number of published entries to cache per content type during hydration
 * Prevents excessive memory usage while still providing warm cache for frequently accessed content
 */
export const CMS_CACHE_MAX_ENTRIES_PER_TYPE = 100;
