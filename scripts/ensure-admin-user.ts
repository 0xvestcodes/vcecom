#!/usr/bin/env node

// Load .env file before checking DATABASE_URL
import { resolve } from "node:path";
import { config } from "dotenv";

// Load from root .env
const rootEnvPath = resolve(__dirname, "../.env");
config({ path: rootEnvPath });

// Check DATABASE_URL before importing db
if (!process.env.DATABASE_URL) {
  console.log("⚠️  DATABASE_URL not set, skipping");
  process.exit(0);
}

import * as bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../packages/db/src/schema";
import { users } from "../packages/db/src/schema";

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@vcecom.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";

async function ensureAdminUser() {
  try {
    // Check if admin user exists
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .limit(1);

    if (existingAdmin) {
      // Admin exists - check if password needs updating
      const isValid = await bcrypt.compare(ADMIN_PASSWORD, existingAdmin.passwordHash || "");
      
      if (!isValid) {
        // Update password
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await db
          .update(users)
          .set({
            passwordHash,
            role: "admin", // Ensure role is admin
          })
          .where(eq(users.id, existingAdmin.id));

        console.log("✅ Admin user password updated");
        console.log(`   Email: ${ADMIN_EMAIL}`);
        console.log(`   Password: ${ADMIN_PASSWORD}`);
        console.log(`   Role: admin`);
      } else {
        // Ensure role is admin
        if (existingAdmin.role !== "admin") {
          await db
            .update(users)
            .set({ role: "admin" })
            .where(eq(users.id, existingAdmin.id));
          console.log("✅ Admin user role updated to 'admin'");
        } else {
          console.log("✅ Admin user already exists with correct credentials");
        }
        console.log(`   Email: ${ADMIN_EMAIL}`);
        console.log(`   Password: ${ADMIN_PASSWORD}`);
        console.log(`   Role: admin`);
      }
    } else {
      // Create admin user
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      const [adminUser] = await db
        .insert(users)
        .values({
          email: ADMIN_EMAIL,
          passwordHash,
          role: "admin",
        } as {
          email: string;
          passwordHash: string;
          role: "admin" | "customer" | "support" | "reviewer" | "marketing";
        })
        .returning();

      if (!adminUser) {
        throw new Error("Failed to create admin user");
      }

      console.log("✅ Admin user created successfully");
      console.log(`   Email: ${ADMIN_EMAIL}`);
      console.log(`   Password: ${ADMIN_PASSWORD}`);
      console.log(`   Role: admin`);
      console.log(`   Hash format: bcrypt (starts with $2b$)`);
    }
  } catch (error) {
    console.error("❌ Error ensuring admin user:", error);
    throw error;
  }
}

async function main() {
  await ensureAdminUser();
  await pool.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});

