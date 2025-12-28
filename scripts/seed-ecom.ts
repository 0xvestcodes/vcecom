#!/usr/bin/env node

// Load .env file before checking DATABASE_URL
import { resolve } from "node:path";
import { config } from "dotenv";

// Load from root .env
const rootEnvPath = resolve(__dirname, "../.env");
config({ path: rootEnvPath });

// Check DATABASE_URL before importing db
if (!process.env.DATABASE_URL) {
  console.log("⚠️  DATABASE_URL not set, skipping seed");
  process.exit(0);
}

import * as bcrypt from "bcrypt";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import Redis from "ioredis";
import { Pool } from "pg";
import * as schema from "../packages/db/src/schema";
import {
  addresses,
  bundleSetItems,
  bundleSets,
  bundles,
  categories,
  customers,
  discountCategories,
  discountProducts,
  discountTieredRules,
  discounts,
  orderItems,
  orders,
  productVariants,
  products,
  reviews,
  users,
} from "../packages/db/src/schema";

// Create database connection for seeding
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

// Helper functions for generating realistic data
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomChoices<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `ORD-${dateStr}-${random}`;
}

function randomDateInPast(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysAgo));
  return date;
}

// Indian cities and states
const INDIAN_CITIES = [
  { city: "Mumbai", state: "Maharashtra", pincode: "400001" },
  { city: "Delhi", state: "Delhi", pincode: "110001" },
  { city: "Bangalore", state: "Karnataka", pincode: "560001" },
  { city: "Hyderabad", state: "Telangana", pincode: "500001" },
  { city: "Chennai", state: "Tamil Nadu", pincode: "600001" },
  { city: "Kolkata", state: "West Bengal", pincode: "700001" },
  { city: "Pune", state: "Maharashtra", pincode: "411001" },
  { city: "Ahmedabad", state: "Gujarat", pincode: "380001" },
  { city: "Jaipur", state: "Rajasthan", pincode: "302001" },
  { city: "Surat", state: "Gujarat", pincode: "395001" },
];

// Product data templates
const TSHIRT_PRODUCTS = [
  "Classic Cotton T-Shirt",
  "Premium V-Neck Tee",
  "Slim Fit Polo Shirt",
  "Oversized Comfort T-Shirt",
  "Graphic Print T-Shirt",
  "Basic Crew Neck Tee",
  "Striped Casual T-Shirt",
  "Henley Neck T-Shirt",
  "Long Sleeve T-Shirt",
  "Ribbed Knit T-Shirt",
];

const JEANS_PRODUCTS = [
  "Slim Fit Denim Jeans",
  "Straight Leg Jeans",
  "Skinny Fit Jeans",
  "Relaxed Fit Jeans",
  "High Waist Jeans",
  "Low Rise Jeans",
  "Distressed Denim Jeans",
  "Black Denim Jeans",
];

const JACKET_PRODUCTS = [
  "Classic Denim Jacket",
  "Bomber Jacket",
  "Hooded Windbreaker",
  "Leather Moto Jacket",
  "Quilted Puffer Jacket",
  "Trench Coat",
];

const ACCESSORY_PRODUCTS = [
  "Genuine Leather Belt",
  "Canvas Belt",
  "Baseball Cap",
  "Beanie Cap",
];

// Review templates
const REVIEW_TITLES = [
  "Great product!",
  "Highly recommended",
  "Good quality",
  "Worth the money",
  "Perfect fit",
  "Love it!",
  "Not bad",
  "Could be better",
  "Disappointed",
];

const REVIEW_BODIES = [
  "Excellent quality and great fit. Highly satisfied with my purchase.",
  "The product exceeded my expectations. Very comfortable and stylish.",
  "Good value for money. Would definitely buy again.",
  "Quality is decent but could be improved. Overall satisfied.",
  "Perfect fit and great material. Fast shipping too.",
  "Not what I expected but it's okay. The quality is average.",
  "Great product at this price point. Very happy with the purchase.",
  "The product is good but the sizing is a bit off. Otherwise fine.",
  "Disappointed with the quality. Expected better for this price.",
  "Amazing product! Best purchase I've made in a while.",
];

// Store seeded data for relationships
let seededData: {
  categories: Map<string, { id: string; name: string }>;
  products: Map<string, { id: string; categoryId: string }>;
  variants: Map<string, { id: string; productId: string }>;
  bundles: { id: string }[];
  customers: { id: string; userId: string }[];
  orders: { id: string; customerId: string; status: string }[];
  discounts: { id: string; code: string }[];
} = {
  categories: new Map(),
  products: new Map(),
  variants: new Map(),
  bundles: [],
  customers: [],
  orders: [],
  discounts: [],
};

// Seed Categories
async function seedCategories() {
  console.log("\n📁 Seeding categories...");

  try {
    // Check if categories already exist
    const existing = await db.select().from(categories).limit(1);
    if (existing.length > 0) {
      console.log("⏭️  Categories already exist, skipping...");
      // Load existing categories
      const allCategories = await db.select().from(categories);
      for (const cat of allCategories) {
        seededData.categories.set(cat.slug, { id: cat.id, name: cat.name });
      }
      return;
    }

    // Create parent categories
    const [clothingParent] = await db
      .insert(categories)
      .values({
        name: "Clothing",
        slug: "clothing",
        description: "All clothing items",
      })
      .returning();

    const [accessoriesParent] = await db
      .insert(categories)
      .values({
        name: "Accessories",
        slug: "accessories",
        description: "Fashion accessories",
      })
      .returning();

    seededData.categories.set("clothing", {
      id: clothingParent.id,
      name: clothingParent.name,
    });
    seededData.categories.set("accessories", {
      id: accessoriesParent.id,
      name: accessoriesParent.name,
    });

    // Create child categories
    const [tshirts] = await db
      .insert(categories)
      .values({
        name: "T-Shirts",
        slug: "t-shirts",
        parentId: clothingParent.id,
        description: "Comfortable t-shirts for everyday wear",
      })
      .returning();

    const [jeans] = await db
      .insert(categories)
      .values({
        name: "Jeans",
        slug: "jeans",
        parentId: clothingParent.id,
        description: "Classic and modern denim jeans",
      })
      .returning();

    const [jackets] = await db
      .insert(categories)
      .values({
        name: "Jackets",
        slug: "jackets",
        parentId: clothingParent.id,
        description: "Stylish jackets and outerwear",
      })
      .returning();

    const [belts] = await db
      .insert(categories)
      .values({
        name: "Belts",
        slug: "belts",
        parentId: accessoriesParent.id,
        description: "Leather and fabric belts",
      })
      .returning();

    const [caps] = await db
      .insert(categories)
      .values({
        name: "Caps",
        slug: "caps",
        parentId: accessoriesParent.id,
        description: "Baseball caps and beanies",
      })
      .returning();

    seededData.categories.set("t-shirts", { id: tshirts.id, name: tshirts.name });
    seededData.categories.set("jeans", { id: jeans.id, name: jeans.name });
    seededData.categories.set("jackets", { id: jackets.id, name: jackets.name });
    seededData.categories.set("belts", { id: belts.id, name: belts.name });
    seededData.categories.set("caps", { id: caps.id, name: caps.name });

    console.log("✅ Created 7 categories (2 parents, 5 children)");
  } catch (error) {
    console.error("❌ Error seeding categories:", error);
    throw error;
  }
}

// Seed Products and Variants
async function seedProducts() {
  console.log("\n🛍️  Seeding products and variants...");

  try {
    // Check if we already have enough products (20+)
    const existingProducts = await db.select().from(products);
    if (existingProducts.length >= 20) {
      console.log(`⏭️  Already have ${existingProducts.length} products (>=20), skipping...`);
      // Load existing products and variants
      const allVariants = await db.select().from(productVariants);
      for (const prod of existingProducts) {
        seededData.products.set(prod.id, {
          id: prod.id,
          categoryId: prod.categoryId || "",
        });
      }
      for (const variant of allVariants) {
        seededData.variants.set(variant.id, {
          id: variant.id,
          productId: variant.productId,
        });
      }
      return;
    }

    // If we have some products but not enough, load them first
    if (existingProducts.length > 0) {
      console.log(`📝 Found ${existingProducts.length} existing products, will add more...`);
      const allVariants = await db.select().from(productVariants);
      for (const prod of existingProducts) {
        seededData.products.set(prod.id, {
          id: prod.id,
          categoryId: prod.categoryId || "",
        });
      }
      for (const variant of allVariants) {
        seededData.variants.set(variant.id, {
          id: variant.id,
          productId: variant.productId,
        });
      }
    }

    const tshirtCategoryId = seededData.categories.get("t-shirts")?.id;
    const jeansCategoryId = seededData.categories.get("jeans")?.id;
    const jacketsCategoryId = seededData.categories.get("jackets")?.id;
    const beltsCategoryId = seededData.categories.get("belts")?.id;
    const capsCategoryId = seededData.categories.get("caps")?.id;

    if (!tshirtCategoryId || !jeansCategoryId || !jacketsCategoryId) {
      throw new Error("Categories not found");
    }

    const sizes = ["S", "M", "L", "XL"];
    const tshirtColors = ["Black", "White", "Navy", "Red"];
    const jeansSizes = ["28", "30", "32", "34", "36", "38"];
    const jeansColors = ["Blue", "Black"];
    const jacketSizes = ["S", "M", "L", "XL", "XXL"];
    const jacketColors = ["Black", "Grey", "Olive"];

    // Seed T-Shirts (8-10 products)
    const tshirtCount = randomInt(8, 10);
    const tshirtProducts = randomChoices(TSHIRT_PRODUCTS, tshirtCount);
    const tshirtProductIds: string[] = [];

    for (const productName of tshirtProducts) {
      const price = randomInt(499, 1299);
      const [product] = await db
        .insert(products)
        .values({
          title: productName,
          description: `Comfortable ${productName.toLowerCase()} made from premium cotton. Perfect for casual wear.`,
          price,
          gstRate: 12,
          pricingType: "exclusive",
          hsnCode: "6109",
          status: "active",
          categoryId: tshirtCategoryId,
          isDigital: false,
          isPreorder: false,
        })
        .returning();

      tshirtProductIds.push(product.id);
      seededData.products.set(product.id, {
        id: product.id,
        categoryId: tshirtCategoryId,
      });

      // Create variants (not all size-color combinations)
      const variantCount = randomInt(4, 8);
      const selectedSizes = randomChoices(sizes, Math.min(variantCount, sizes.length));
      const selectedColors = randomChoices(
        tshirtColors,
        Math.min(variantCount, tshirtColors.length),
      );

      for (let i = 0; i < variantCount; i++) {
        const size = selectedSizes[i % selectedSizes.length];
        const color = selectedColors[i % selectedColors.length];
        // Generate unique SKU with variant index and random suffix to avoid collisions
        const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
        const sku = `TSH-${product.id.slice(0, 8)}-${size}-${color.slice(0, 3).toUpperCase()}-${i}-${randomSuffix}`;

        const [variant] = await db
          .insert(productVariants)
          .values({
            productId: product.id,
            sku,
            price,
            compareAtPrice: randomInt(price + 200, price + 500),
            currency: "INR",
            inventory: randomInt(10, 100),
            size,
            color,
            weight: randomFloat(0.2, 0.5),
          })
          .returning();

        seededData.variants.set(variant.id, {
          id: variant.id,
          productId: product.id,
        });
      }
    }

    // Seed Jeans (6-8 products)
    const jeansCount = randomInt(6, 8);
    const jeansProducts = randomChoices(JEANS_PRODUCTS, jeansCount);
    const jeansProductIds: string[] = [];

    for (const productName of jeansProducts) {
      const price = randomInt(1499, 2999);
      const [product] = await db
        .insert(products)
        .values({
          title: productName,
          description: `Stylish ${productName.toLowerCase()} with premium denim fabric.`,
          price,
          gstRate: 12,
          pricingType: "exclusive",
          hsnCode: "6203",
          status: "active",
          categoryId: jeansCategoryId,
          isDigital: false,
          isPreorder: false,
        })
        .returning();

      jeansProductIds.push(product.id);
      seededData.products.set(product.id, {
        id: product.id,
        categoryId: jeansCategoryId,
      });

      // Create variants
      const variantCount = randomInt(4, 6);
      const selectedSizes = randomChoices(jeansSizes, Math.min(variantCount, jeansSizes.length));
      const selectedColors = randomChoices(jeansColors, Math.min(variantCount, jeansColors.length));

      for (let i = 0; i < variantCount; i++) {
        const size = selectedSizes[i % selectedSizes.length];
        const color = selectedColors[i % selectedColors.length];
        // Generate unique SKU with variant index and random suffix to avoid collisions
        const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
        const sku = `JNS-${product.id.slice(0, 8)}-${size}-${color.slice(0, 3).toUpperCase()}-${i}-${randomSuffix}`;

        const [variant] = await db
          .insert(productVariants)
          .values({
            productId: product.id,
            sku,
            price,
            compareAtPrice: randomInt(price + 500, price + 1000),
            currency: "INR",
            inventory: randomInt(10, 100),
            size,
            color,
            weight: randomFloat(0.5, 1.0),
          })
          .returning();

        seededData.variants.set(variant.id, {
          id: variant.id,
          productId: product.id,
        });
      }
    }

    // Seed Jackets (4-6 products)
    const jacketsCount = randomInt(4, 6);
    const jacketsProducts = randomChoices(JACKET_PRODUCTS, jacketsCount);

    for (const productName of jacketsProducts) {
      const price = randomInt(2999, 5999);
      const [product] = await db
        .insert(products)
        .values({
          title: productName,
          description: `Premium ${productName.toLowerCase()} for all seasons.`,
          price,
          gstRate: 18,
          pricingType: "exclusive",
          hsnCode: "6203",
          status: "active",
          categoryId: jacketsCategoryId,
          isDigital: false,
          isPreorder: false,
        })
        .returning();

      seededData.products.set(product.id, {
        id: product.id,
        categoryId: jacketsCategoryId,
      });

      // Create variants
      const variantCount = randomInt(3, 5);
      const selectedSizes = randomChoices(jacketSizes, Math.min(variantCount, jacketSizes.length));
      const selectedColors = randomChoices(
        jacketColors,
        Math.min(variantCount, jacketColors.length),
      );

      for (let i = 0; i < variantCount; i++) {
        const size = selectedSizes[i % selectedSizes.length];
        const color = selectedColors[i % selectedColors.length];
        // Generate unique SKU with variant index and random suffix to avoid collisions
        const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
        const sku = `JCK-${product.id.slice(0, 8)}-${size}-${color.slice(0, 3).toUpperCase()}-${i}-${randomSuffix}`;

        const [variant] = await db
          .insert(productVariants)
          .values({
            productId: product.id,
            sku,
            price,
            compareAtPrice: randomInt(price + 1000, price + 2000),
            currency: "INR",
            inventory: randomInt(10, 50),
            size,
            color,
            weight: randomFloat(0.8, 1.5),
          })
          .returning();

        seededData.variants.set(variant.id, {
          id: variant.id,
          productId: product.id,
        });
      }
    }

    // Seed Accessories (2-4 products)
    let accessoryCount = 0;
    if (beltsCategoryId && capsCategoryId) {
      accessoryCount = randomInt(2, 4);
      const accessoryProducts = randomChoices(ACCESSORY_PRODUCTS, accessoryCount);

      for (const productName of accessoryProducts) {
        const isBelt = productName.toLowerCase().includes("belt");
        const categoryId = isBelt ? beltsCategoryId : capsCategoryId;
        const price = randomInt(299, 899);
        const [product] = await db
          .insert(products)
          .values({
            title: productName,
            description: `Quality ${productName.toLowerCase()} for your wardrobe.`,
            price,
            gstRate: 12,
            pricingType: "exclusive",
            hsnCode: isBelt ? "4203" : "6505",
            status: "active",
            categoryId,
            isDigital: false,
            isPreorder: false,
          })
          .returning();

        seededData.products.set(product.id, {
          id: product.id,
          categoryId,
        });

        // Create minimal variants
        // Generate unique SKU with random suffix to avoid collisions
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const sku = `ACC-${product.id.slice(0, 8)}-${randomSuffix}`;
        const [variant] = await db
          .insert(productVariants)
          .values({
            productId: product.id,
            sku,
            price,
            currency: "INR",
            inventory: randomInt(20, 100),
            weight: randomFloat(0.1, 0.3),
          })
          .returning();

        seededData.variants.set(variant.id, {
          id: variant.id,
          productId: product.id,
        });
      }
    }

    const createdProducts = tshirtCount + jeansCount + jacketsCount + accessoryCount;
    const totalVariants = Array.from(seededData.variants.values()).length;
    const totalProducts = seededData.products.size;
    console.log(`✅ Created ${createdProducts} new products (total: ${totalProducts} products, ${totalVariants} variants)`);
  } catch (error) {
    console.error("❌ Error seeding products:", error);
    throw error;
  }
}

// Seed Bundles
async function seedBundles() {
  console.log("\n📦 Seeding bundles...");

  try {
    // Check if we already have enough bundles (5+)
    const existingBundles = await db.select().from(bundles);
    const existingBundlesCount = existingBundles.length;
    if (existingBundlesCount >= 5) {
      console.log(`⏭️  Already have ${existingBundlesCount} bundles (>=5), skipping...`);
      seededData.bundles = existingBundles.map((b) => ({ id: b.id }));
      return;
    }

    // If we have some bundles but not enough, load them first
    if (existingBundlesCount > 0) {
      console.log(`📝 Found ${existingBundlesCount} existing bundles, will add more...`);
      seededData.bundles = existingBundles.map((b) => ({ id: b.id }));
    }

    // Get variants by category
    const tshirtCategoryId = seededData.categories.get("t-shirts")?.id;
    const jeansCategoryId = seededData.categories.get("jeans")?.id;
    const jacketsCategoryId = seededData.categories.get("jackets")?.id;

    if (!tshirtCategoryId || !jeansCategoryId || !jacketsCategoryId) {
      throw new Error("Categories not found");
    }

    const tshirtVariants = Array.from(seededData.variants.values()).filter((v) => {
      const product = seededData.products.get(v.productId);
      return product?.categoryId === tshirtCategoryId;
    });

    const jeansVariants = Array.from(seededData.variants.values()).filter((v) => {
      const product = seededData.products.get(v.productId);
      return product?.categoryId === jeansCategoryId;
    });

    const jacketsVariants = Array.from(seededData.variants.values()).filter((v) => {
      const product = seededData.products.get(v.productId);
      return product?.categoryId === jacketsCategoryId;
    });

    if (tshirtVariants.length === 0 || jeansVariants.length === 0) {
      console.log("⏭️  Not enough variants for bundles, skipping...");
      return;
    }

    // Bundle 1: Complete Outfit Bundle (T-shirt + Jeans)
    const [bundle1] = await db
      .insert(bundles)
      .values({
        title: "Complete Outfit Bundle",
        description: "Get a complete outfit with a t-shirt and jeans",
        isActive: true,
        allowMixAndMatch: false,
      })
      .returning();

    seededData.bundles.push({ id: bundle1.id });

    const [set1a] = await db
      .insert(bundleSets)
      .values({
        bundleId: bundle1.id,
        title: "Select T-Shirt",
        minQuantity: 1,
        maxQuantity: 1,
        sortOrder: 0,
      })
      .returning();

    const [set1b] = await db
      .insert(bundleSets)
      .values({
        bundleId: bundle1.id,
        title: "Select Jeans",
        minQuantity: 1,
        maxQuantity: 1,
        sortOrder: 1,
      })
      .returning();

    // Add variants to sets
    const selectedTshirtVariants = randomChoices(tshirtVariants, 5);
    const selectedJeansVariants = randomChoices(jeansVariants, 5);

    for (const variant of selectedTshirtVariants) {
      await db.insert(bundleSetItems).values({
        setId: set1a.id,
        variantId: variant.id,
      });
    }

    for (const variant of selectedJeansVariants) {
      await db.insert(bundleSetItems).values({
        setId: set1b.id,
        variantId: variant.id,
      });
    }

    // Bundle 2: Winter Pack (Jacket + Jeans)
    if (jacketsVariants.length > 0) {
      const [bundle2] = await db
        .insert(bundles)
        .values({
          title: "Winter Pack",
          description: "Stay warm with jacket and jeans combo",
          isActive: true,
          allowMixAndMatch: false,
        })
        .returning();

      seededData.bundles.push({ id: bundle2.id });

      const [set2a] = await db
        .insert(bundleSets)
        .values({
          bundleId: bundle2.id,
          title: "Select Jacket",
          minQuantity: 1,
          maxQuantity: 1,
          sortOrder: 0,
        })
        .returning();

      const [set2b] = await db
        .insert(bundleSets)
        .values({
          bundleId: bundle2.id,
          title: "Select Jeans",
          minQuantity: 1,
          maxQuantity: 1,
          sortOrder: 1,
        })
        .returning();

      const selectedJacketVariants = randomChoices(jacketsVariants, 3);
      const selectedJeansVariants2 = randomChoices(jeansVariants, 5);

      for (const variant of selectedJacketVariants) {
        await db.insert(bundleSetItems).values({
          setId: set2a.id,
          variantId: variant.id,
        });
      }

      for (const variant of selectedJeansVariants2) {
        await db.insert(bundleSetItems).values({
          setId: set2b.id,
          variantId: variant.id,
        });
      }
    }

    // Bundle 3: Casual Set (2 T-shirts + Belt)
    const [bundle3] = await db
      .insert(bundles)
      .values({
        title: "Casual Set",
        description: "Two t-shirts and a belt for casual days",
        isActive: true,
        allowMixAndMatch: false,
      })
      .returning();

    seededData.bundles.push({ id: bundle3.id });

    const [set3a] = await db
      .insert(bundleSets)
      .values({
        bundleId: bundle3.id,
        title: "Select 2 T-Shirts",
        minQuantity: 2,
        maxQuantity: 2,
        sortOrder: 0,
      })
      .returning();

    const selectedTshirtVariants2 = randomChoices(tshirtVariants, 8);
    for (const variant of selectedTshirtVariants2) {
      await db.insert(bundleSetItems).values({
        setId: set3a.id,
        variantId: variant.id,
      });
    }

    // Bundle 4: Mix and Match
    const [bundle4] = await db
      .insert(bundles)
      .values({
        title: "Mix and Match Bundle",
        description: "Create your own combination",
        isActive: true,
        allowMixAndMatch: true,
      })
      .returning();

    seededData.bundles.push({ id: bundle4.id });

    const [set4a] = await db
      .insert(bundleSets)
      .values({
        bundleId: bundle4.id,
        title: "Select Items",
        minQuantity: 2,
        maxQuantity: 5,
        sortOrder: 0,
      })
      .returning();

    const allVariants = [...tshirtVariants, ...jeansVariants].slice(0, 15);
    for (const variant of allVariants) {
      await db.insert(bundleSetItems).values({
        setId: set4a.id,
        variantId: variant.id,
      });
    }

    // Bundle 5: Premium Bundle (Jacket + Jeans + T-shirt)
    if (jacketsVariants.length > 0) {
      const [bundle5] = await db
        .insert(bundles)
        .values({
          title: "Premium Bundle",
          description: "Complete premium outfit",
          isActive: true,
          allowMixAndMatch: false,
        })
        .returning();

      seededData.bundles.push({ id: bundle5.id });

      const [set5a] = await db
        .insert(bundleSets)
        .values({
          bundleId: bundle5.id,
          title: "Select Jacket",
          minQuantity: 1,
          maxQuantity: 1,
          sortOrder: 0,
        })
        .returning();

      const [set5b] = await db
        .insert(bundleSets)
        .values({
          bundleId: bundle5.id,
          title: "Select Jeans",
          minQuantity: 1,
          maxQuantity: 1,
          sortOrder: 1,
        })
        .returning();

      const [set5c] = await db
        .insert(bundleSets)
        .values({
          bundleId: bundle5.id,
          title: "Select T-Shirt",
          minQuantity: 1,
          maxQuantity: 1,
          sortOrder: 2,
        })
        .returning();

      const selectedJacketVariants2 = randomChoices(jacketsVariants, 3);
      const selectedJeansVariants3 = randomChoices(jeansVariants, 5);
      const selectedTshirtVariants3 = randomChoices(tshirtVariants, 5);

      for (const variant of selectedJacketVariants2) {
        await db.insert(bundleSetItems).values({
          setId: set5a.id,
          variantId: variant.id,
        });
      }

      for (const variant of selectedJeansVariants3) {
        await db.insert(bundleSetItems).values({
          setId: set5b.id,
          variantId: variant.id,
        });
      }

      for (const variant of selectedTshirtVariants3) {
        await db.insert(bundleSetItems).values({
          setId: set5c.id,
          variantId: variant.id,
        });
      }
    }

    const createdBundles = seededData.bundles.length - existingBundlesCount;
    const totalBundles = seededData.bundles.length;
    console.log(`✅ Created ${createdBundles} new bundles (total: ${totalBundles} bundles)`);
  } catch (error) {
    console.error("❌ Error seeding bundles:", error);
    throw error;
  }
}

// Seed Customers, Users, and Addresses
async function seedCustomers() {
  console.log("\n👥 Seeding customers, users, and addresses...");

  try {
    // Check if customers already exist
    const existing = await db.select().from(customers).limit(1);
    if (existing.length > 0) {
      console.log("⏭️  Customers already exist, skipping...");
      const allCustomers = await db.select().from(customers);
      seededData.customers = allCustomers.map((c) => ({
        id: c.id,
        userId: c.userId,
      }));
      return;
    }

    const customerCount = randomInt(10, 15);
    const firstNames = [
      "Raj",
      "Priya",
      "Amit",
      "Sneha",
      "Vikram",
      "Anjali",
      "Rahul",
      "Kavya",
      "Arjun",
      "Meera",
      "Siddharth",
      "Divya",
      "Karan",
      "Isha",
      "Rohan",
    ];
    const lastNames = [
      "Sharma",
      "Patel",
      "Kumar",
      "Singh",
      "Gupta",
      "Reddy",
      "Verma",
      "Joshi",
      "Mehta",
      "Agarwal",
    ];

    for (let i = 0; i < customerCount; i++) {
      const firstName = randomChoice(firstNames);
      const lastName = randomChoice(lastNames);
      const name = `${firstName} ${lastName}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
      const phone = `9${randomInt(100000000, 999999999)}`;
      const isGuest = Math.random() < 0.3; // 30% guest customers

      // Create user
      const passwordHash = isGuest
        ? null
        : await bcrypt.hash("Test@123", 10);

      const [user] = await db
        .insert(users)
        .values({
          email,
          passwordHash,
          role: "customer",
        })
        .returning();

      // Create customer
      const [customer] = await db
        .insert(customers)
        .values({
          userId: user.id,
          email,
          phone,
          name,
          isGuest,
          emailVerified: !isGuest,
        })
        .returning();

      seededData.customers.push({ id: customer.id, userId: user.id });

      // Create addresses (1-3 per customer)
      const addressCount = randomInt(1, 3);
      const location = randomChoice(INDIAN_CITIES);

      for (let j = 0; j < addressCount; j++) {
        const isDefault = j === 0;
        const addressType = j === 0 ? "both" : randomChoice(["shipping", "billing"]);

        await db.insert(addresses).values({
          customerId: customer.id,
          type: addressType,
          street: `${randomInt(1, 999)} ${randomChoice(["Main Street", "Park Avenue", "MG Road", "Church Street"])}`,
          city: location.city,
          state: location.state,
          pincode: String(randomInt(100000, 999999)),
          district: location.city,
          country: "India",
          isDefault,
        });
      }
    }

    console.log(`✅ Created ${customerCount} customers with addresses`);
  } catch (error) {
    console.error("❌ Error seeding customers:", error);
    throw error;
  }
}

// Seed Orders
async function seedOrders() {
  console.log("\n📋 Seeding orders...");

  try {
    // Check if orders already exist
    const existing = await db.select().from(orders).limit(1);
    if (existing.length > 0) {
      console.log("⏭️  Orders already exist, skipping...");
      const allOrders = await db.select().from(orders);
      seededData.orders = allOrders.map((o) => ({
        id: o.id,
        customerId: o.customerId,
        status: o.status,
      }));
      return;
    }

    if (seededData.customers.length === 0) {
      console.log("⏭️  No customers found, skipping orders...");
      return;
    }

    if (seededData.variants.size === 0) {
      console.log("⏭️  No variants found, skipping orders...");
      return;
    }

    const orderCount = randomInt(30, 50);
    const statuses: Array<"pending" | "confirmed" | "processing" | "shipped" | "delivered"> = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
    ];
    const statusWeights = [0.1, 0.15, 0.2, 0.25, 0.3]; // More delivered orders

    function weightedRandomStatus(): string {
      const rand = Math.random();
      let sum = 0;
      for (let i = 0; i < statuses.length; i++) {
        sum += statusWeights[i];
        if (rand <= sum) {
          return statuses[i];
        }
      }
      return statuses[statuses.length - 1];
    }

    const variantIds = Array.from(seededData.variants.keys());

    for (let i = 0; i < orderCount; i++) {
      const customer = randomChoice(seededData.customers);
      const status = weightedRandomStatus() as typeof statuses[number];

      // Get customer addresses
      const customerAddresses = await db
        .select()
        .from(addresses)
        .where(eq(addresses.customerId, customer.id))
        .limit(2);

      if (customerAddresses.length === 0) {
        continue;
      }

      const shippingAddress = customerAddresses[0];
      const billingAddress = customerAddresses.length > 1 ? customerAddresses[1] : customerAddresses[0];

      // Create order items (1-5 items per order)
      const itemCount = randomInt(1, 5);
      const selectedVariants = randomChoices(variantIds, itemCount);

      // Calculate totals
      let subtotal = 0;
      let gstAmount = 0;

      const orderItemsData: Array<{
        variantId: string;
        quantity: number;
        price: number;
        gstRate: number;
        gstAmount: number;
      }> = [];
      for (const variantId of selectedVariants) {
        const variant = await db
          .select()
          .from(productVariants)
          .where(eq(productVariants.id, variantId))
          .limit(1);

        if (variant.length === 0) continue;

        const product = await db
          .select()
          .from(products)
          .where(eq(products.id, variant[0].productId))
          .limit(1);

        if (product.length === 0) continue;

        const quantity = randomInt(1, 3);
        const price = variant[0].price;
        const gstRate = product[0].gstRate;
        const itemSubtotal = price * quantity;
        const itemGst = (itemSubtotal * gstRate) / 100;

        subtotal += itemSubtotal;
        gstAmount += itemGst;

        orderItemsData.push({
          variantId,
          quantity,
          price,
          gstRate,
          gstAmount: itemGst,
        });
      }

      if (orderItemsData.length === 0) continue;

      const shippingCost = randomInt(50, 200);
      const discountAmount = Math.random() < 0.3 ? randomInt(100, 500) : 0; // 30% have discounts
      const total = subtotal + gstAmount + shippingCost - discountAmount;

      const createdAt = randomDateInPast(180); // Last 6 months

      // Create order
      const [order] = await db
        .insert(orders)
        .values({
          customerId: customer.id,
          orderNumber: generateOrderNumber(),
          status,
          subtotal,
          gstAmount,
          discountCode: discountAmount > 0 ? "TEST-DISCOUNT" : null,
          discountAmount,
          shippingCost,
          paymentFee: 0,
          paymentFeeCurrency: "INR",
          total,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
          createdAt,
          updatedAt: createdAt,
        })
        .returning();

      seededData.orders.push({
        id: order.id,
        customerId: order.customerId,
        status: order.status,
      });

      // Create order items
      for (const itemData of orderItemsData) {
        await db.insert(orderItems).values({
          orderId: order.id,
          productVariantId: itemData.variantId,
          quantity: itemData.quantity,
          price: itemData.price,
          gstRate: itemData.gstRate,
          gstAmount: itemData.gstAmount,
        });
      }
    }

    console.log(`✅ Created ${seededData.orders.length} orders`);
  } catch (error) {
    console.error("❌ Error seeding orders:", error);
    throw error;
  }
}

// Seed Reviews
async function seedReviews() {
  console.log("\n⭐ Seeding reviews...");

  try {
    // Check if reviews already exist
    const existing = await db.select().from(reviews).limit(1);
    if (existing.length > 0) {
      console.log("⏭️  Reviews already exist, skipping...");
      return;
    }

    // Only create reviews for delivered orders
    const deliveredOrders = seededData.orders.filter((o) => o.status === "delivered");

    if (deliveredOrders.length === 0) {
      console.log("⏭️  No delivered orders found, skipping reviews...");
      return;
    }

    const reviewCount = randomInt(50, 100);
    const statuses: Array<"pending" | "approved" | "rejected"> = ["pending", "approved", "rejected"];
    const statusWeights = [0.15, 0.8, 0.05]; // 80% approved

    function weightedRandomStatus(): string {
      const rand = Math.random();
      let sum = 0;
      for (let i = 0; i < statuses.length; i++) {
        sum += statusWeights[i];
        if (rand <= sum) {
          return statuses[i];
        }
      }
      return statuses[statuses.length - 1];
    }

    // Rating distribution (weighted toward 4-5)
    function randomRating(): number {
      const rand = Math.random();
      if (rand < 0.05) return 1;
      if (rand < 0.1) return 2;
      if (rand < 0.2) return 3;
      if (rand < 0.6) return 4;
      return 5;
    }

    let createdCount = 0;

    for (let i = 0; i < reviewCount && i < deliveredOrders.length * 2; i++) {
      const order = randomChoice(deliveredOrders);

      // Get order items
      const orderItemsList = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .limit(5);

      if (orderItemsList.length === 0) continue;

      const orderItem = randomChoice(orderItemsList) as { productVariantId: string };
      const variantId = orderItem.productVariantId;

      // Check if review already exists for this customer-variant pair
      const existingReview = await db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.customerId, order.customerId),
            eq(reviews.variantId, variantId),
          ),
        )
        .limit(1);

      if (existingReview.length > 0) continue;

      const rating = randomRating();
      const status = weightedRandomStatus() as typeof statuses[number];
      const title = Math.random() < 0.7 ? randomChoice(REVIEW_TITLES) : null;
      const body = randomChoice(REVIEW_BODIES);
      const images = Math.random() < 0.2 ? [`https://example.com/review-${i}.jpg`] : null;

      await db.insert(reviews).values({
        customerId: order.customerId,
        orderId: order.id,
        variantId,
        rating,
        title,
        body,
        images: images ? images : undefined,
        status,
      });

      createdCount++;
    }

    console.log(`✅ Created ${createdCount} reviews`);
  } catch (error) {
    console.error("❌ Error seeding reviews:", error);
    throw error;
  }
}

// Seed Discounts
async function seedDiscounts() {
  console.log("\n🎟️  Seeding discounts...");

  try {
    // Check if discounts already exist
    const existing = await db.select().from(discounts).limit(1);
    if (existing.length > 0) {
      console.log("⏭️  Discounts already exist, skipping...");
      const allDiscounts = await db.select().from(discounts);
      seededData.discounts = allDiscounts.map((d) => ({ id: d.id, code: d.code }));
      return;
    }

    const tshirtCategoryId = seededData.categories.get("t-shirts")?.id;
    const jeansCategoryId = seededData.categories.get("jeans")?.id;

    if (!tshirtCategoryId || !jeansCategoryId) {
      throw new Error("Categories not found");
    }

    // Get T-shirt products for automatic discount
    const tshirtProducts = Array.from(seededData.products.values()).filter(
      (p) => p.categoryId === tshirtCategoryId,
    );
    const selectedTshirtProducts = randomChoices(tshirtProducts, 3);

    const now = new Date();
    const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days from now

    // 1. FIXED_AMOUNT Discounts (2-3)
    const fixedDiscounts = [
      {
        code: "SAVE500",
        name: "Save ₹500",
        description: "Get ₹500 off on orders above ₹2000",
        valueType: "AMOUNT" as const,
        value: 500,
        minOrderAmount: 2000,
        maxDiscountAmount: null,
        scope: "ORDER" as const,
        priority: 5,
      },
      {
        code: "FLAT300",
        name: "Flat ₹300 Off",
        description: "Flat ₹300 discount on all products",
        valueType: "AMOUNT" as const,
        value: 300,
        minOrderAmount: 1500,
        maxDiscountAmount: null,
        scope: "PRODUCT" as const,
        priority: 6,
      },
    ];

    for (const discountData of fixedDiscounts) {
      const [discount] = await db
        .insert(discounts)
        .values({
          code: discountData.code,
          name: discountData.name,
          description: discountData.description,
          type: "FIXED_AMOUNT",
          applicationType: "MANUAL",
          valueType: discountData.valueType,
          value: discountData.value,
          minOrderAmount: discountData.minOrderAmount,
          maxDiscountAmount: discountData.maxDiscountAmount,
          scope: discountData.scope,
          appliesTo: "SUBTOTAL",
          priority: discountData.priority,
          canStack: true,
          mutuallyExclusive: false,
          startDate,
          endDate,
          isActive: true,
          usageLimit: 1000,
          usageCount: 0,
        })
        .returning();

      seededData.discounts.push({ id: discount.id, code: discount.code });
    }

    // 2. PERCENTAGE Discounts (2-3)
    const percentageDiscounts = [
      {
        code: "GET20",
        name: "20% Off",
        description: "Get 20% off (max ₹500 discount)",
        value: 20,
        minOrderAmount: 1000,
        maxDiscountAmount: 500,
        scope: "PRODUCT" as const,
        priority: 4,
      },
      {
        code: "SAVE15",
        name: "15% Discount",
        description: "15% off on selected items",
        value: 15,
        minOrderAmount: 800,
        maxDiscountAmount: 1000,
        scope: "PRODUCT" as const,
        priority: 5,
      },
    ];

    for (const discountData of percentageDiscounts) {
      const [discount] = await db
        .insert(discounts)
        .values({
          code: discountData.code,
          name: discountData.name,
          description: discountData.description,
          type: "PERCENTAGE",
          applicationType: "MANUAL",
          valueType: "PERCENTAGE",
          value: discountData.value,
          minOrderAmount: discountData.minOrderAmount,
          maxDiscountAmount: discountData.maxDiscountAmount,
          scope: discountData.scope,
          appliesTo: "SUBTOTAL",
          priority: discountData.priority,
          canStack: true,
          mutuallyExclusive: false,
          startDate,
          endDate,
          isActive: true,
          usageLimit: 500,
          usageCount: 0,
        })
        .returning();

      seededData.discounts.push({ id: discount.id, code: discount.code });
    }

    // 3. BUY_X_GET_Y Discounts (2)
    const bogoDiscounts = [
      {
        code: "BOGO-TSHIRT",
        name: "Buy 2 Get 50% Off",
        description: "Buy 2 T-shirts, get 50% off on second",
        value: 50,
        minQuantity: 2,
        categoryId: tshirtCategoryId,
        priority: 3,
      },
    ];

    for (const discountData of bogoDiscounts) {
      const [discount] = await db
        .insert(discounts)
        .values({
          code: discountData.code,
          name: discountData.name,
          description: discountData.description,
          type: "BUY_X_GET_Y",
          applicationType: "MANUAL",
          valueType: "PERCENTAGE",
          value: discountData.value,
          minQuantity: discountData.minQuantity,
          scope: "PRODUCT",
          appliesTo: "SUBTOTAL",
          priority: discountData.priority,
          canStack: false,
          mutuallyExclusive: true,
          startDate,
          endDate,
          isActive: true,
          usageLimit: 200,
          usageCount: 0,
        })
        .returning();

      // Link to category
      await db.insert(discountCategories).values({
        discountId: discount.id,
        categoryId: discountData.categoryId,
      });

      seededData.discounts.push({ id: discount.id, code: discount.code });
    }

    // 4. TIERED Discounts (2)
    const tieredDiscounts = [
      {
        code: "BULK-JEANS",
        name: "Bulk Jeans Discount",
        description: "Buy more, save more on jeans",
        categoryId: jeansCategoryId,
        priority: 2,
      },
    ];

    for (const discountData of tieredDiscounts) {
      const [discount] = await db
        .insert(discounts)
        .values({
          code: discountData.code,
          name: discountData.name,
          description: discountData.description,
          type: "TIERED",
          applicationType: "MANUAL",
          valueType: "PERCENTAGE",
          value: 10, // Base value (not used in tiered)
          scope: "PRODUCT",
          appliesTo: "SUBTOTAL",
          priority: discountData.priority,
          canStack: false,
          mutuallyExclusive: true,
          startDate,
          endDate,
          isActive: true,
          usageLimit: 300,
          usageCount: 0,
        })
        .returning();

      // Link to category
      await db.insert(discountCategories).values({
        discountId: discount.id,
        categoryId: discountData.categoryId,
      });

      // Create tiered rules
      await db.insert(discountTieredRules).values([
        {
          discountId: discount.id,
          minQuantity: 2,
          value: 10,
          valueType: "PERCENTAGE",
        },
        {
          discountId: discount.id,
          minQuantity: 3,
          value: 15,
          valueType: "PERCENTAGE",
        },
        {
          discountId: discount.id,
          minQuantity: 4,
          value: 20,
          valueType: "PERCENTAGE",
        },
      ]);

      seededData.discounts.push({ id: discount.id, code: discount.code });
    }

    // 5. CART_LEVEL Discounts (1-2)
    const cartDiscounts = [
      {
        code: "CART500",
        name: "Cart ₹500 Off",
        description: "₹500 off on cart subtotal > ₹3000",
        value: 500,
        minOrderAmount: 3000,
        priority: 7,
      },
    ];

    for (const discountData of cartDiscounts) {
      const [discount] = await db
        .insert(discounts)
        .values({
          code: discountData.code,
          name: discountData.name,
          description: discountData.description,
          type: "CART_LEVEL",
          applicationType: "MANUAL",
          valueType: "AMOUNT",
          value: discountData.value,
          minOrderAmount: discountData.minOrderAmount,
          scope: "ORDER",
          appliesTo: "SUBTOTAL",
          priority: discountData.priority,
          canStack: true,
          mutuallyExclusive: false,
          startDate,
          endDate,
          isActive: true,
          usageLimit: 500,
          usageCount: 0,
        })
        .returning();

      seededData.discounts.push({ id: discount.id, code: discount.code });
    }

    // 6. AUTOMATIC Discount on 3 T-shirt Products (KEY REQUIREMENT)
    if (selectedTshirtProducts.length === 3) {
      const [autoDiscount] = await db
        .insert(discounts)
        .values({
          code: "AUTO-CLOTHING-3",
          name: "Automatic T-Shirt Discount",
          description: "Automatic 15% off on selected T-shirts",
          type: "PERCENTAGE",
          applicationType: "AUTOMATIC", // AUTOMATIC!
          valueType: "PERCENTAGE",
          value: 15,
          minOrderAmount: 1500,
          maxDiscountAmount: 500,
          scope: "PRODUCT",
          appliesTo: "SUBTOTAL",
          priority: 1, // High priority
          canStack: true,
          mutuallyExclusive: false,
          startDate,
          endDate,
          isActive: true,
          usageLimit: null, // Unlimited
          usageCount: 0,
        })
        .returning();

      // Link to 3 specific T-shirt products
      for (const product of selectedTshirtProducts) {
        await db.insert(discountProducts).values({
          discountId: autoDiscount.id,
          productId: product.id,
        });
      }

      seededData.discounts.push({ id: autoDiscount.id, code: autoDiscount.code });
      console.log("✅ Created AUTOMATIC discount on 3 T-shirt products");
    }

    console.log(`✅ Created ${seededData.discounts.length} discounts of all types`);
  } catch (error) {
    console.error("❌ Error seeding discounts:", error);
    throw error;
  }
}

// Sync inventory from database to Redis
async function syncInventoryToRedis() {
  console.log("\n🔄 Syncing inventory to Redis...");

  try {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const redis = new Redis(redisUrl, {
      retryStrategy: () => null, // Don't retry if Redis is unavailable
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });

    // Try to connect
    try {
      await redis.connect();
    } catch (error) {
      console.log("⏭️  Redis not available, skipping inventory sync");
      redis.disconnect();
      return;
    }

    // Get all variants with inventory
    const allVariants = await db
      .select({
        id: productVariants.id,
        inventory: productVariants.inventory,
      })
      .from(productVariants);

    if (allVariants.length === 0) {
      console.log("⏭️  No variants found, skipping inventory sync");
      redis.disconnect();
      return;
    }

    // Sync each variant's inventory to Redis
    const pipeline = redis.pipeline();
    let syncedCount = 0;

    for (const variant of allVariants) {
      const inventoryKey = `inventory:variant:${variant.id}`;
      pipeline.set(inventoryKey, variant.inventory.toString());
      syncedCount++;
    }

    await pipeline.exec();
    await redis.disconnect();

    console.log(`✅ Synced ${syncedCount} variant inventories to Redis`);
  } catch (error) {
    // Don't fail the seed if Redis sync fails
    console.log("⚠️  Failed to sync inventory to Redis (non-critical):", error instanceof Error ? error.message : "Unknown error");
    console.log("   Inventory will sync automatically when variants are accessed");
  }
}

// Main seed function
async function seed() {
  console.log("🌱 Starting e-commerce seed script...\n");

  try {
    await seedCategories();
    await seedProducts();
    await syncInventoryToRedis(); // Sync inventory after products are created
    await seedBundles();
    await seedCustomers();
    await seedOrders();
    await seedReviews();
    await seedDiscounts();

    console.log("\n✅ E-commerce seed completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   Categories: ${seededData.categories.size}`);
    console.log(`   Products: ${seededData.products.size}`);
    console.log(`   Variants: ${seededData.variants.size}`);
    console.log(`   Bundles: ${seededData.bundles.length}`);
    console.log(`   Customers: ${seededData.customers.length}`);
    console.log(`   Orders: ${seededData.orders.length}`);
    console.log(`   Discounts: ${seededData.discounts.length}`);
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  }
}

// Run seed
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

