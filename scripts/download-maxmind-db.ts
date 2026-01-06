#!/usr/bin/env tsx
/**
 * Script to download MaxMind GeoIP2 database
 * Supports:
 * - GEO_DATABASE_URL: Custom database URL
 * - MAXMIND_LICENSE_KEY: For official MaxMind download (fallback)
 * - Default: GitHub redist URL (no license key needed)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";
import * as zlib from "node:zlib";
import { pipeline } from "node:stream/promises";

const db = "GeoLite2-City";
const DEFAULT_DATABASE_PATH = "./data/GeoLite2-City.mmdb";

// Support custom URL via environment variable
let url = process.env.GEO_DATABASE_URL;

// Fallback to default URLs if not provided
if (!url) {
  if (process.env.MAXMIND_LICENSE_KEY) {
    url =
      `https://download.maxmind.com/app/geoip_download` +
      `?edition_id=${db}&license_key=${process.env.MAXMIND_LICENSE_KEY}&suffix=tar.gz`;
  } else {
    url = `https://raw.githubusercontent.com/GitSquared/node-geolite2-redist/master/redist/${db}.tar.gz`;
  }
}

async function downloadDatabase(
  databaseUrl: string,
  outputPath: string,
): Promise<void> {
  const outputDir = path.dirname(outputPath);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Downloading MaxMind GeoIP2 database from ${databaseUrl}...`);

  return new Promise((resolve, reject) => {
    https.get(databaseUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(
          new Error(
            `Failed to download database: ${response.statusCode} ${response.statusMessage}`,
          ),
        );
        return;
      }

      const tempTarPath = `${outputPath}.tar.gz`;
      const writeStream = fs.createWriteStream(tempTarPath);

      response.pipe(writeStream);

      writeStream.on("finish", () => {
        console.log("Download complete. Extracting...");

        // Extract the tar.gz file
        // Note: This is a simplified version. For production, use a proper tar library
        // like 'tar' or 'node-tar'
        const extract = require("tar").extract({
          file: tempTarPath,
          cwd: outputDir,
        });

        extract.on("end", () => {
          // Find the .mmdb file in the extracted directory
          const extractedDir = fs
            .readdirSync(outputDir)
            .find((dir) => dir.startsWith("GeoLite2-City_"));
          if (extractedDir) {
            const mmdbFile = path.join(
              outputDir,
              extractedDir,
              "GeoLite2-City.mmdb",
            );
            if (fs.existsSync(mmdbFile)) {
              fs.renameSync(mmdbFile, outputPath);
              // Clean up extracted directory and tar.gz
              fs.rmSync(path.join(outputDir, extractedDir), {
                recursive: true,
                force: true,
              });
              fs.unlinkSync(tempTarPath);
              console.log(`Database saved to ${outputPath}`);
              resolve();
            } else {
              reject(new Error("Database file not found in archive"));
            }
          } else {
            reject(new Error("Extracted directory not found"));
          }
        });

        extract.on("error", (error: Error) => {
          reject(error);
        });
      });

      writeStream.on("error", (error: Error) => {
        reject(error);
      });
    });
  });
}

async function main() {
  const databasePath =
    process.env.MAXMIND_DATABASE_PATH || DEFAULT_DATABASE_PATH;

  // URL is already determined at module level with fallback logic
  if (!url) {
    console.error(
      "Error: Unable to determine database URL. Please provide one of:",
    );
    console.error("  - GEO_DATABASE_URL (custom URL)");
    console.error("  - MAXMIND_LICENSE_KEY (for MaxMind official download)");
    console.error(
      "  - Or use the default GitHub redist URL (no license key needed)",
    );
    process.exit(1);
  }

  try {
    await downloadDatabase(url, databasePath);
    console.log("MaxMind database download completed successfully!");
  } catch (error) {
    console.error("Failed to download MaxMind database:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
