import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Injectable, OnModuleInit } from "@nestjs/common";

/**
 * Environment Override Service
 * Allows overriding environment variables from files for local development
 * Priority: .env.local > .env.development > .env
 */
@Injectable()
export class EnvOverrideService implements OnModuleInit {
  private overrides: Map<string, string> = new Map();

  onModuleInit() {
    this.loadOverrides();
  }

  /**
   * Load environment overrides from files
   */
  private loadOverrides(): void {
    const rootPath = resolve(__dirname, "../../../../..");
    const envFiles = [
      resolve(rootPath, ".env.local"),
      resolve(rootPath, ".env.development"),
      resolve(rootPath, ".env"),
    ];

    for (const envFile of envFiles) {
      if (existsSync(envFile)) {
        try {
          const content = readFileSync(envFile, "utf-8");
          const lines = content.split("\n");

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
              const [key, ...valueParts] = trimmed.split("=");
              if (key && valueParts.length > 0) {
                const value = valueParts.join("=").replace(/^["']|["']$/g, "");
                this.overrides.set(key.trim(), value.trim());
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to load ${envFile}:`, error);
        }
      }
    }
  }

  /**
   * Get overridden value for an environment variable
   */
  getOverride(key: string): string | undefined {
    return this.overrides.get(key);
  }

  /**
   * Get all overrides
   */
  getAllOverrides(): Record<string, string> {
    return Object.fromEntries(this.overrides);
  }

  /**
   * Check if an override exists
   */
  hasOverride(key: string): boolean {
    return this.overrides.has(key);
  }

  /**
   * Apply overrides to process.env (use with caution!)
   */
  applyOverrides(): void {
    if (process.env.NODE_ENV === "production") {
      console.warn("Environment overrides are disabled in production");
      return;
    }

    for (const [key, value] of this.overrides.entries()) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}
