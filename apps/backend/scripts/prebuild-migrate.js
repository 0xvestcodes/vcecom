#!/usr/bin/env node

/**
 * Prebuild migration script with fallback strategy
 *
 * Strategy:
 * 1. Try running existing migrations
 * 2. If that fails -> generate new migrations and migrate
 * 3. If that fails -> use db:push --force to sync schema directly
 * 4. If all fail -> continue with warning (for CI/CD environments)
 */

const { execSync } = require("node:child_process");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "../..");
const dbPackageDir = path.join(rootDir, "packages/db");

function log(message, color = "reset") {
  const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, cwd, description) {
  try {
    log(`Running: ${description}`, "green");
    execSync(command, {
      stdio: "inherit",
      cwd,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
    });
    return true;
  } catch (_error) {
    log(`Failed: ${description}`, "yellow");
    return false;
  }
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  log("⚠️  DATABASE_URL not set - skipping migrations", "yellow");
  process.exit(0);
}

// Step 1: Try running migrations
log("Step 1: Attempting to run migrations...", "green");
if (runCommand("pnpm db:migrate:run", dbPackageDir, "Run migrations")) {
  log("✅ Migrations completed successfully", "green");
  process.exit(0);
}

// Step 2: Generate migrations and migrate
log("Step 2: Migrations failed, generating new migrations...", "yellow");
if (
  runCommand("pnpm db:generate", dbPackageDir, "Generate migrations") &&
  runCommand("pnpm db:migrate:run", dbPackageDir, "Run generated migrations")
) {
  log("✅ Migrations generated and applied successfully", "green");
  process.exit(0);
}

// Step 3: Fallback to db:push --force
log("Step 3: Migration generation failed, using db:push --force...", "yellow");
if (runCommand("pnpm db:push:ci", dbPackageDir, "Push schema to database")) {
  log("✅ Schema pushed successfully", "green");
  process.exit(0);
}

// Step 4: All strategies failed
log("⚠️  All migration strategies failed - continuing build", "yellow");
log("Database may need manual intervention", "yellow");
process.exit(0);
