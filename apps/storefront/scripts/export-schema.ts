/**
 * Export Content Schema Script
 *
 * Exports the content schema as JSON for backend sync.
 * This script is used during build to send schema to backend.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { exportSchemaAsJSON } from "../content-schema";

const schema = exportSchemaAsJSON();
const outputPath = join(process.cwd(), ".next", "content-schema.json");

// Ensure .next directory exists
import { mkdirSync } from "node:fs";

try {
  mkdirSync(join(process.cwd(), ".next"), { recursive: true });
} catch {
  // Directory might already exist
}

writeFileSync(outputPath, JSON.stringify(schema, null, 2), "utf-8");

const keys = Array.isArray(schema.keys) ? schema.keys : Object.keys(schema);
console.log(`✅ Content schema exported to ${outputPath}`);
console.log(`   Keys: ${keys.join(", ")}`);
