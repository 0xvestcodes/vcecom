#!/usr/bin/env node

/**
 * Predeploy Script for Database Migrations
 * Generates migrations from schema changes and runs them
 *
 * Usage:
 *   node scripts/predeploy.js                    # Generate and migrate
 *   node scripts/predeploy.js --skip-generate     # Only migrate (for CI/CD)
 *   node scripts/predeploy.js --skip-migrate      # Only generate migrations
 *
 * Environment Variables:
 *   DATABASE_URL - PostgreSQL connection string (required)
 */

const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const args = process.argv.slice(2);
const skipGenerate = args.includes("--skip-generate");
const skipMigrate = args.includes("--skip-migrate");

// Colors for output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
};

function log(message, color = "reset") {
  const prefix =
    color === "green"
      ? "[INFO]"
      : color === "yellow"
        ? "[WARN]"
        : color === "red"
          ? "[ERROR]"
          : "";
  console.log(`${colors[color]}${prefix}${colors.reset} ${message}`);
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  log("DATABASE_URL environment variable is not set", "red");
  process.exit(1);
}

// Get paths
const scriptDir = __dirname;
const backendDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(backendDir, "../..");
const dbPackageDir = path.join(rootDir, "packages", "db");

log("Starting predeploy database migration process...", "green");
log(`Root directory: ${rootDir}`);
log(`Database package: ${dbPackageDir}`);

// Step 1: Generate migrations
if (!skipGenerate) {
  log("Step 1: Generating migrations from schema changes...", "green");

  try {
    process.chdir(dbPackageDir);

    // Check if drizzle-kit is available
    const nodeModulesBin = path.join(
      dbPackageDir,
      "node_modules",
      ".bin",
      "drizzle-kit",
    );
    if (!fs.existsSync(nodeModulesBin)) {
      log("drizzle-kit not found, installing dependencies...", "yellow");
      execSync("pnpm install", { stdio: "inherit", cwd: dbPackageDir });
    }

    // Generate migrations
    log("Running: pnpm db:generate");
    execSync("pnpm db:generate", { stdio: "inherit", cwd: dbPackageDir });
    log("Migrations generated successfully", "green");

    // Check for new migrations (if git is available)
    try {
      const gitStatus = execSync("git status --porcelain drizzle/", {
        encoding: "utf-8",
        cwd: rootDir,
        stdio: "pipe",
      });
      const newMigrations = gitStatus
        .split("\n")
        .filter((line) => line.includes(".sql"));
      if (newMigrations.length > 0) {
        log(
          "New migration files detected. Please review and commit them before deploying.",
          "yellow",
        );
        log("Migration files:", "yellow");
        for (const file of newMigrations) {
          log(`  ${file.trim()}`, "yellow");
        }
      }
    } catch (_error) {
      // Git not available or not a git repo - ignore
    }
  } catch (error) {
    log(`Failed to generate migrations: ${error.message}`, "red");
    process.exit(1);
  }
} else {
  log("Step 1: Skipping migration generation (--skip-generate flag)", "green");
}

// Step 2: Run migrations
if (!skipMigrate) {
  log("Step 2: Running database migrations...", "green");

  try {
    process.chdir(dbPackageDir);

    // Check if migrations folder exists
    const drizzleDir = path.join(dbPackageDir, "drizzle");
    if (!fs.existsSync(drizzleDir)) {
      log(
        "Migrations folder not found. Run migration generation first.",
        "red",
      );
      process.exit(1);
    }

    // Check if there are any migration SQL files
    const sqlFiles = fs
      .readdirSync(drizzleDir, { recursive: true })
      .filter((file) => typeof file === "string" && file.endsWith(".sql"));

    if (sqlFiles.length === 0) {
      log(
        "No migration SQL files found. Database schema may already be up to date.",
        "yellow",
      );
    } else {
      log(`Found ${sqlFiles.length} migration SQL file(s)`, "green");
    }

    // Ensure the db package is built
    log("Building database package...", "green");
    execSync("pnpm build", { stdio: "inherit", cwd: dbPackageDir });

    // Run migrations using the migrate-cli (non-interactive)
    log("Running: pnpm db:migrate:run");
    execSync("pnpm db:migrate:run", {
      stdio: "inherit",
      cwd: dbPackageDir,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
    });
    log("Migrations applied successfully", "green");
  } catch (error) {
    log(`Failed to run migrations: ${error.message}`, "red");
    process.exit(1);
  }
} else {
  log("Step 2: Skipping migration execution (--skip-migrate flag)", "green");
}

log("Predeploy database migration process completed successfully!", "green");
