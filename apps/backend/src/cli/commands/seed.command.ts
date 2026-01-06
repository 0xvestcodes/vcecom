#!/usr/bin/env node

/**
 * Seed Command
 * CLI command for seeding the database
 */

import { resolve } from "node:path";
import { config } from "dotenv";

// Load environment variables
const rootEnvPath = resolve(__dirname, "../../../../.env");
config({ path: rootEnvPath });

import { NestFactory } from "@nestjs/core";
import { CliModule } from "../cli.module";
import { CliService } from "../cli.service";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const app = await NestFactory.createApplicationContext(CliModule);
  const cliService = app.get(CliService);

  try {
    switch (command) {
      case "fixtures": {
        const scenario = args[1] || "full";
        const count = parseInt(args[2] || "1", 10);
        await cliService.seedFixtures({ scenario, count });
        break;
      }

      default:
        console.log("Usage: pnpm cli:seed fixtures [scenario] [count]");
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
