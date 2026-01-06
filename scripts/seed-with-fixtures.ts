#!/usr/bin/env node

/**
 * Enhanced Seed Script with Fixtures Support
 * Provides a more flexible seeding system using fixtures
 */

import { resolve } from "node:path";
import { config } from "dotenv";

// Load .env file before checking DATABASE_URL
const rootEnvPath = resolve(__dirname, "../.env");
config({ path: rootEnvPath });

// Check DATABASE_URL before importing db
if (!process.env.DATABASE_URL) {
  console.log("⚠️  DATABASE_URL not set, skipping seed");
  process.exit(0);
}

import { NestFactory } from "@nestjs/core";
import { CliModule } from "../apps/backend/src/cli/cli.module";
import { CliService } from "../apps/backend/src/cli/cli.service";
import { FixturesService } from "../apps/backend/src/common/fixtures/fixtures.service";

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "fixtures"; // 'fixtures' or 'full'

  console.log("🌱 Starting enhanced seed script...\n");

  const app = await NestFactory.createApplicationContext(CliModule);
  const fixturesService = app.get(FixturesService);
  const cliService = app.get(CliService);

  try {
    if (mode === "fixtures") {
      // Use fixtures for quick test data
      const count = parseInt(args[1] || "5", 10);
      console.log(`Creating ${count} test scenarios...\n`);

      for (let i = 0; i < count; i++) {
        await fixturesService.createTestScenario();
        console.log(`✅ Created test scenario ${i + 1}/${count}`);
      }

      console.log("\n✅ Fixtures seeded successfully!");
    } else if (mode === "full") {
      // Run the full seed script
      console.log("Running full seed script...\n");
      // Import and run the original seed script
      const { execSync } = require("child_process");
      execSync("ts-node scripts/seed-ecom.ts", { stdio: "inherit" });
    } else if (mode === "clean") {
      // Clean up test data
      if (process.env.NODE_ENV === "production") {
        console.error("❌ Cannot clean test data in production");
        process.exit(1);
      }

      console.log("🧹 Cleaning up test data...");
      await fixturesService.cleanupTestData();
      console.log("✅ Test data cleaned successfully!");
    } else {
      console.log("Usage:");
      console.log("  pnpm seed:fixtures [count]  - Seed with fixtures (default: 5)");
      console.log("  pnpm seed:full              - Run full seed script");
      console.log("  pnpm seed:clean             - Clean test data");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
