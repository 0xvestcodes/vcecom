#!/usr/bin/env node

/**
 * API Key Command
 * CLI command for managing API keys
 */

import { resolve } from "node:path";
import { config } from "dotenv";

// Load environment variables
const rootEnvPath = resolve(__dirname, "../../../../.env");
config({ path: rootEnvPath });

import { NestFactory } from "@nestjs/core";
import { users } from "@vcecom/db";
import { eq } from "drizzle-orm";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { CliModule } from "../cli.module";
import { CliService } from "../cli.service";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const app = await NestFactory.createApplicationContext(CliModule);
  const cliService = app.get(CliService);
  const db = app.get<Database>(DB_TOKEN);

  try {
    switch (command) {
      case "create": {
        const email = args[1];
        const name = args[2] || `CLI Key ${new Date().toISOString()}`;
        const type = (args[3] as "read" | "write" | "admin") || "read";

        if (!email) {
          console.error("❌ Error: Email is required");
          console.log("Usage: pnpm cli:api-key create <email> [name] [type]");
          process.exit(1);
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) {
          console.error(`❌ Error: User with email ${email} not found`);
          process.exit(1);
        }

        await cliService.createApiKey(user.id, name, type);
        break;
      }

      case "list": {
        const email = args[1];

        if (!email) {
          console.error("❌ Error: Email is required");
          console.log("Usage: pnpm cli:api-key list <email>");
          process.exit(1);
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) {
          console.error(`❌ Error: User with email ${email} not found`);
          process.exit(1);
        }

        await cliService.listApiKeys(user.id);
        break;
      }

      default:
        console.log("Usage:");
        console.log("  pnpm cli:api-key create <email> [name] [type]");
        console.log("  pnpm cli:api-key list <email>");
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
