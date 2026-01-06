#!/usr/bin/env node

// Load .env file before checking DATABASE_URL
import { resolve } from "node:path";
import { config } from "dotenv";

// Only load from root .env (when compiled, __dirname is packages/db/dist)
// 3 levels up: dist -> db -> packages -> ecommerce (root)
const rootEnvPath = resolve(__dirname, "../../../.env");
config({ path: rootEnvPath });

// Check DATABASE_URL before importing db (which throws if not set)
if (!process.env.DATABASE_URL) {
  console.log("⚠️  DATABASE_URL not set, skipping seed");
  process.exit(0);
}

import * as bcrypt from "bcrypt";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import {
  currencies,
  paymentMethodCharges,
  shippingMethods,
  users,
} from "./schema";
import type { NewCurrency } from "./schema/currencies";
import type { NewPaymentMethodCharge } from "./schema/payment-method-charges";
import type { NewShippingMethod } from "./schema/shipping-rules";

// Create database connection for seeding
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@vcecom.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";

async function seedAdminUser() {
  try {
    // Check if any users exist
    const existingUsers = await db.select().from(users).limit(1);

    if (existingUsers.length > 0) {
      console.log("✅ Users already exist, skipping admin user seed");
      return;
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // Create admin user
    // Note: roleId column may not exist in database yet, so we only set required fields
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

    console.log("✅ Admin user seeded successfully");
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Role: admin`);
    console.log(`   Hash format: bcrypt (starts with $2b$)`);
  } catch (error) {
    console.error("❌ Error seeding admin user:", error);
    // Don't throw - continue with payment method charges seeding
  }
}

async function seedPaymentMethodCharges() {
  try {
    // Seed default payment method charges
    const charges = [
      {
        method: "COD" as const,
        chargeType: "FLAT" as const,
        flatAmount: 2900, // ₹30
        percentage: 0,
        mixCap: null,
        mixMin: null,
        isTaxable: false,
        currency: "INR",
        codMaxAmount: null,
        codDisallowHighValue: false,
        codDisallowDigital: true,
        codDisallowPreorder: true,
        codDisallowInternational: true,
        active: true,
        storeLevelDisabled: false,
      },
    ];

    let createdCount = 0;
    let updatedCount = 0;

    for (const charge of charges) {
      // Check if payment method already exists
      const existing = await db
        .select()
        .from(paymentMethodCharges)
        .where(
          and(
            eq(paymentMethodCharges.method, charge.method),
            eq(paymentMethodCharges.currency, charge.currency),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing to ensure it's active and not disabled
        await db
          .update(paymentMethodCharges)
          .set({
            chargeType: charge.chargeType,
            flatAmount: charge.flatAmount,
            percentage: charge.percentage,
            mixCap: charge.mixCap,
            mixMin: charge.mixMin,
            isTaxable: charge.isTaxable,
            active: true,
            storeLevelDisabled: false,
            updatedAt: new Date(),
          } as Partial<NewPaymentMethodCharge>)
          .where(eq(paymentMethodCharges.id, existing[0].id));
        updatedCount++;
      } else {
        // Create new payment method charge
        await db.insert(paymentMethodCharges).values(charge);
        createdCount++;
      }
    }

    if (createdCount > 0) {
      console.log(`✅ Created ${createdCount} payment method charge(s)`);
    }
    if (updatedCount > 0) {
      console.log(
        `✅ Updated ${updatedCount} payment method charge(s) to ensure they're active`,
      );
    }
    if (createdCount === 0 && updatedCount === 0) {
      console.log("✅ All payment method charges are already configured");
    }
  } catch (error) {
    console.error("❌ Error seeding payment method charges:", error);
    // Don't throw - seed failures shouldn't break the process
  }
}

async function seedShippingMethods() {
  try {
    // Check if "standard" shipping method already exists
    const existing = await db
      .select()
      .from(shippingMethods)
      .where(eq(shippingMethods.code, "standard"))
      .limit(1);

    if (existing.length > 0) {
      console.log("✅ Standard shipping method already exists, skipping");
      return;
    }

    // Create default "Standard" shipping method
    const [method] = await db
      .insert(shippingMethods)
      .values({
        name: "Standard",
        description: "Standard delivery within 5-7 business days",
        code: "standard",
        baseRate: 0, // Free shipping by default
        estimatedDays: 7,
        codAvailable: true,
        codCharge: null,
        isActive: true,
        priority: 0,
        minOrderValue: null,
        maxOrderValue: null,
        restrictedZones: null,
        restrictedStates: null,
      } as NewShippingMethod)
      .returning();

    if (!method) {
      throw new Error("Failed to create standard shipping method");
    }

    console.log("✅ Created default 'Standard' shipping method");
    console.log(`   Code: ${method.code}`);
    console.log(`   Name: ${method.name}`);
  } catch (error) {
    console.error("❌ Error seeding shipping methods:", error);
    // Don't throw - seed failures shouldn't break the process
  }
}

async function seedCurrencies() {
  try {
    // Seed default currencies
    const defaultCurrencies: Array<{
      code: string;
      name: string;
      symbol: string;
      isActive: boolean;
      isDefault: boolean;
      decimalPlaces: number;
      exchangeRate: number | null;
      lastUpdated: Date | null;
    }> = [
      {
        code: "INR",
        name: "Indian Rupee",
        symbol: "₹",
        isActive: true,
        isDefault: true,
        decimalPlaces: 2,
        exchangeRate: 1, // Base currency
        lastUpdated: new Date(),
      },
      {
        code: "USD",
        name: "US Dollar",
        symbol: "$",
        isActive: true,
        isDefault: false,
        decimalPlaces: 2,
        exchangeRate: null, // Will be fetched from FX provider
        lastUpdated: null,
      },
      {
        code: "EUR",
        name: "Euro",
        symbol: "€",
        isActive: true,
        isDefault: false,
        decimalPlaces: 2,
        exchangeRate: null,
        lastUpdated: null,
      },
      {
        code: "GBP",
        name: "British Pound",
        symbol: "£",
        isActive: true,
        isDefault: false,
        decimalPlaces: 2,
        exchangeRate: null,
        lastUpdated: null,
      },
    ];

    let createdCount = 0;
    let updatedCount = 0;

    for (const currency of defaultCurrencies) {
      // Check if currency already exists
      const existing = await db
        .select()
        .from(currencies)
        .where(eq(currencies.code, currency.code))
        .limit(1);

      if (existing.length > 0) {
        // If setting as default, unset other defaults first
        if (currency.isDefault) {
          await db
            .update(currencies)
            .set({
              isDefault: false,
              updatedAt: new Date(),
            } as Partial<typeof currencies.$inferInsert>)
            .where(eq(currencies.isDefault, true));
        }

        // Update existing currency to ensure it's active
        await db
          .update(currencies)
          .set({
            name: currency.name,
            symbol: currency.symbol,
            isActive: currency.isActive,
            decimalPlaces: currency.decimalPlaces,
            isDefault: currency.isDefault,
            updatedAt: new Date(),
            // Only update exchangeRate if it's being set (INR base currency)
            ...(currency.exchangeRate !== null && {
              exchangeRate: currency.exchangeRate,
              lastUpdated: currency.lastUpdated,
            }),
          } as Partial<NewCurrency>)
          .where(eq(currencies.code, currency.code));

        updatedCount++;
      } else {
        // Create new currency
        await db.insert(currencies).values(currency);
        createdCount++;
      }
    }

    if (createdCount > 0) {
      console.log(`✅ Created ${createdCount} currency/currencies`);
    }
    if (updatedCount > 0) {
      console.log(`✅ Updated ${updatedCount} currency/currencies`);
    }
    if (createdCount === 0 && updatedCount === 0) {
      console.log("✅ All currencies are already configured");
    }
  } catch (error) {
    console.error("❌ Error seeding currencies:", error);
    // Don't throw - seed failures shouldn't break the process
  }
}

async function seed() {
  await seedAdminUser();
  await seedPaymentMethodCharges();
  await seedShippingMethods();
  await seedCurrencies();
  console.log("✅ Seed completed");
  process.exit(0);
}

seed()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    // Close the pool when done
    pool.end().catch(() => {
      // Ignore errors on pool close
    });
  });
