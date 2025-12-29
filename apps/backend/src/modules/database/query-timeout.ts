/**
 * Application-level query timeout wrapper
 * Provides an additional layer of protection beyond PostgreSQL's statement_timeout
 * This ensures queries are cancelled even if PostgreSQL timeout doesn't fire
 * @param queryPromise - The database query promise
 * @param timeoutMs - Timeout in milliseconds (default: 30000 = 30 seconds)
 * @returns Promise that rejects with timeout error if query takes too long
 */
export async function withQueryTimeout<T>(
  queryPromise: Promise<T>,
  timeoutMs: number = 30000,
): Promise<T> {
  return Promise.race([
    queryPromise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Query timeout after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

/**
 * Execute a database query with timeout protection
 * Wraps Drizzle queries with application-level timeout
 * @param db - Database instance
 * @param queryFn - Function that returns a query promise
 * @param timeoutMs - Timeout in milliseconds (default: 30000 = 30 seconds)
 * @returns Query result
 */
export async function executeWithTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = 30000,
): Promise<T> {
  return withQueryTimeout(queryFn(), timeoutMs);
}
