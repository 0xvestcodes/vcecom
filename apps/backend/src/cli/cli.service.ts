import { Injectable } from "@nestjs/common";
import { FixturesService } from "../common/fixtures/fixtures.service";
import { ApiKeysService } from "../modules/api-keys/api-keys.service";

/**
 * CLI Service
 * Provides command-line interface functionality
 */
@Injectable()
export class CliService {
  constructor(
    private readonly fixturesService: FixturesService,
    private readonly apiKeysService: ApiKeysService,
  ) {}

  /**
   * Seed database with fixtures
   */
  async seedFixtures(options?: { scenario?: string; count?: number }) {
    console.log("🌱 Seeding fixtures...");

    if (options?.scenario === "full" || !options?.scenario) {
      const count = options?.count || 1;
      for (let i = 0; i < count; i++) {
        await this.fixturesService.createTestScenario();
        console.log(`✅ Created test scenario ${i + 1}/${count}`);
      }
    }

    console.log("✅ Fixtures seeded successfully");
  }

  /**
   * Create an API key
   */
  async createApiKey(
    userId: string,
    name: string,
    type: "read" | "write" | "admin" = "read",
  ) {
    const result = await this.apiKeysService.createApiKey(userId, {
      name,
      type,
    });

    console.log("\n✅ API Key created successfully!");
    console.log(`\nName: ${result.name}`);
    console.log(`Type: ${result.type}`);
    console.log(`Prefix: ${result.keyPrefix}`);
    console.log(`\n⚠️  IMPORTANT: Save this key now - it won't be shown again!`);
    console.log(`\nAPI Key: ${result.apiKey}\n`);

    return result;
  }

  /**
   * List API keys for a user
   */
  async listApiKeys(userId: string) {
    const keys = await this.apiKeysService.listApiKeys(userId);

    console.log(`\n📋 API Keys (${keys.length}):\n`);
    if (keys.length === 0) {
      console.log("No API keys found.");
      return;
    }

    keys.forEach((key) => {
      console.log(`  ${key.name}`);
      console.log(`    ID: ${key.id}`);
      console.log(`    Prefix: ${key.keyPrefix}`);
      console.log(`    Type: ${key.type}`);
      console.log(`    Status: ${key.status}`);
      console.log(`    Created: ${key.createdAt.toISOString()}`);
      if (key.lastUsedAt) {
        console.log(`    Last Used: ${key.lastUsedAt.toISOString()}`);
      }
      console.log("");
    });
  }
}
