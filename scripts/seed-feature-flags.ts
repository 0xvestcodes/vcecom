#!/usr/bin/env node

// Load .env file before checking DATABASE_URL
import { resolve } from "node:path";
import { config } from "dotenv";

// Load from root .env
const rootEnvPath = resolve(__dirname, "../.env");
config({ path: rootEnvPath });

// Check DATABASE_URL before importing db
if (!process.env.DATABASE_URL) {
  console.log("⚠️  DATABASE_URL not set, skipping seed");
  process.exit(0);
}

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../packages/db/src/schema";
import { featureFlags } from "../packages/db/src/schema";
import { eq } from "drizzle-orm";
import { FEATURE_FLAG_KEYS, FEATURE_FLAG_DESCRIPTIONS } from "../apps/backend/src/common/feature-flags/feature-flag-keys";

// Create database connection for seeding
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

// Generate feature flags from FEATURE_FLAG_KEYS
// All flags default to false (OFF) - must be explicitly enabled by admin
const initialFeatureFlags = Object.values(FEATURE_FLAG_KEYS).map((key) => ({
  key,
  description: FEATURE_FLAG_DESCRIPTIONS[key as keyof typeof FEATURE_FLAG_DESCRIPTIONS],
  type: "global" as const,
  defaultState: false, // All flags default to OFF
}));

async function seedFeatureFlags() {
  console.log("🌱 Seeding feature flags...");

  try {
    for (const flag of initialFeatureFlags) {
      // Check if flag already exists
      const [existing] = await db
        .select()
        .from(featureFlags)
        .where(eq(featureFlags.key, flag.key))
        .limit(1);

      if (existing) {
        console.log(`  ⏭️  Feature flag "${flag.key}" already exists, skipping`);
        continue;
      }

      // Insert new feature flag
      await db.insert(featureFlags).values({
        key: flag.key,
        description: flag.description,
        type: flag.type,
        defaultState: flag.defaultState,
      });

      console.log(`  ✅ Created feature flag: ${flag.key} (default: ${flag.defaultState})`);
    }

    console.log("✨ Feature flags seeding completed!");
  } catch (error) {
    console.error("❌ Error seeding feature flags:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the seed
seedFeatureFlags()
  .then(() => {
    console.log("🎉 Seed script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Seed script failed:", error);
    process.exit(1);
  });
