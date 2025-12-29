import * as schema from "@vcecom/db";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let testPool: Pool | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

export function getTestDatabase() {
  if (!testDb) {
    const databaseUrl =
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/vcecom_test";

    testPool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      min: 0,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 5000,
    });

    testDb = drizzle(testPool, { schema });
  }

  return testDb;
}

export async function closeTestDatabase() {
  if (testPool) {
    await testPool.end();
    testPool = null;
    testDb = null;
  }
}

export async function truncateTables(db: ReturnType<typeof drizzle>) {
  // Truncate all tables in reverse order of dependencies
  const tables = [
    "refunds",
    "order_items",
    "orders",
    "payments",
    "checkout_sessions",
    "cart_items",
    "carts",
    "addresses",
    "customers",
  ];

  for (const table of tables) {
    try {
      await db.execute(`TRUNCATE TABLE ${table} CASCADE`);
    } catch (error) {
      // Ignore errors for tables that don't exist
      console.warn(`Failed to truncate ${table}:`, error);
    }
  }
}

export async function clearTestDatabase(db: any) {
  // Clear test database - use truncateTables if available
  try {
    await truncateTables(db);
  } catch (error) {
    console.warn("Failed to clear test database:", error);
  }
}
