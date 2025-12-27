import * as schema from "@vcecom/db";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Create a PostgreSQL connection pool optimized for Railway shared tier
 * Railway shared PostgreSQL has a hard limit of ~15 connections
 * We use max: 10 to leave headroom for Railway overhead and other processes
 */
function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is not set. Please set it to a valid PostgreSQL connection string.",
    );
  }

  // Optimized for Railway shared tier (15 max connections)
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10, // Leave 5 for Railway overhead
    min: 0, // No pre-warming - connections created on-demand
    idleTimeoutMillis: 20000, // Close idle clients after 20 seconds
    connectionTimeoutMillis: 5000, // Fail fast if connection can't be established
    allowExitOnIdle: true, // Allow process to exit when pool is idle
  });

  // Increase max listeners to prevent EventEmitter warnings
  pool.setMaxListeners(50);

  // Handle pool errors to prevent unhandled rejections
  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
  });

  // Monitor pool for connection exhaustion warnings
  let lastWarningTime = 0;
  const WARNING_INTERVAL = 60000; // Only warn once per minute
  const maxConnections = 10;

  pool.on("acquire", (client) => {
    const total = pool.totalCount || 0;
    const idle = pool.idleCount || 0;
    const waiting = pool.waitingCount || 0;
    const used = total - idle;

    // Warn if pool is getting close to max connections
    const usagePercent = (used / maxConnections) * 100;
    const now = Date.now();

    if (usagePercent >= 80 && now - lastWarningTime > WARNING_INTERVAL) {
      lastWarningTime = now;
      console.warn(
        `[DB Pool] High connection usage: ${used}/${maxConnections} (${usagePercent.toFixed(1)}%) - ${waiting} waiting`,
      );
    }

    // Critical warning if pool is exhausted
    if (waiting > 0 && now - lastWarningTime > WARNING_INTERVAL) {
      lastWarningTime = now;
      console.error(
        `[DB Pool] CRITICAL: Pool exhausted! ${used}/${maxConnections} connections in use, ${waiting} requests waiting`,
      );
    }
  });

  // Set statement timeout on each new connection as a fallback
  pool.on("connect", async (client) => {
    try {
      // Set statement timeout to prevent long-running queries from holding connections
      await client.query("SET statement_timeout = 30000"); // 30 seconds
      // Set idle_in_transaction_session_timeout to prevent abandoned transactions
      await client.query("SET idle_in_transaction_session_timeout = 60000"); // 60 seconds
    } catch (err) {
      // Ignore errors setting timeout - connection will still work
      console.warn("Failed to set connection timeouts", err);
    }
  });

  return pool;
}

// Singleton pool instance - created once and reused
let poolInstance: Pool | null = null;

/**
 * Get the database pool instance (singleton)
 * Creates the pool on first access
 */
export function getDatabasePool(): Pool {
  if (!poolInstance) {
    poolInstance = createPool();
  }
  return poolInstance;
}

// Singleton Drizzle instance - created once and reused
let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Get the Drizzle database instance (singleton)
 * Creates the instance on first access
 */
export function getDatabase(): ReturnType<typeof drizzle> {
  if (!dbInstance) {
    const pool = getDatabasePool();
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
}

/**
 * Close the database pool gracefully
 * Waits for all active queries to complete, then closes all connections
 * @param timeout - Maximum time to wait for connections to close (default: 10 seconds)
 * @returns Promise that resolves when pool is closed
 */
export async function closeDatabasePool(
  timeout: number = 10000,
): Promise<void> {
  if (!poolInstance) {
    return;
  }

  const pool = poolInstance;
  poolInstance = null; // Clear reference immediately to prevent new queries
  dbInstance = null;

  try {
    // Wait for active queries to complete, with timeout
    await Promise.race([
      pool.end(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Pool close timeout")), timeout),
      ),
    ]);
  } catch (error) {
    // If timeout occurs, pool.end() is still running in the background
    // The pool will eventually close, but we don't wait for it
    if (error instanceof Error && error.message === "Pool close timeout") {
      console.warn(
        "Database pool close timeout, pool will close in background",
      );
      // Don't call end() again - it's already called and will complete eventually
    } else {
      // Re-throw unexpected errors
      throw error;
    }
  }
}

/**
 * Get connection pool statistics
 * @returns Pool statistics including total, idle, and waiting connections
 */
export function getPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  usedCount: number;
  usagePercent: number;
  maxConnections: number;
} | null {
  if (!poolInstance) {
    return null;
  }

  const totalCount = poolInstance.totalCount || 0;
  const idleCount = poolInstance.idleCount || 0;
  const waitingCount = poolInstance.waitingCount || 0;
  const usedCount = totalCount - idleCount;
  const maxConnections = 10; // Match the pool config
  const usagePercent =
    maxConnections > 0 ? (usedCount / maxConnections) * 100 : 0;

  return {
    totalCount,
    idleCount,
    waitingCount,
    usedCount,
    usagePercent: Math.round(usagePercent * 100) / 100, // Round to 2 decimal places
    maxConnections,
  };
}

/**
 * Check if database pool is healthy
 * @returns true if pool exists and is not ending, false otherwise
 */
export function isPoolHealthy(): boolean {
  if (!poolInstance) {
    return false;
  }
  // Check if pool is ending (being closed)
  // _ending is an internal property of pg.Pool that indicates the pool is closing
  interface PoolWithEnding extends Pool {
    _ending?: boolean;
  }
  return !(poolInstance as PoolWithEnding)._ending;
}

// Export Database type for dependency injection
export type Database = ReturnType<typeof drizzle>;
