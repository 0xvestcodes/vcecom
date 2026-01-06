#!/usr/bin/env node

/**
 * Comprehensive Checkout Flow Test Script
 * 
 * Tests the complete checkout flow from cart creation to order placement:
 * 1. Clear existing cart/reservations
 * 2. Generate session ID
 * 3. Get test product variant
 * 4. Get or create cart
 * 5. Add items to cart
 * 6. Start checkout session
 * 7. Add shipping address
 * 8. Get shipping methods
 * 9. Select shipping method
 * 10. Get payment methods
 * 11. Create order (COD)
 * 12. Verify order creation
 * 
 * Usage: pnpm tsx scripts/test-checkout-flow.ts [--guest|--authenticated]
 * 
 * Note: To disable reservation limits for testing, add to your backend .env file:
 *   MAX_RESERVATIONS_PER_FINGERPRINT=0
 * Then restart the backend server. Setting it to 0 disables the limit (unlimited reservations).
 * Default is 3 reservations per device if not set.
 */

import { resolve } from "node:path";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { productVariants, products } from "../packages/db/src/schema";
import * as schema from "../packages/db/src/schema";

// Load .env file
const rootEnvPath = resolve(__dirname, "../.env");
config({ path: rootEnvPath });

// Note: To disable reservation limits, set MAX_RESERVATIONS_PER_FINGERPRINT=0
// in your backend .env file (apps/backend/.env) and restart the backend server.
// The test script cannot set this - it must be configured in the backend process.

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const STOREFRONT_BASE_URL = process.env.STOREFRONT_BASE_URL || "http://localhost:3002";

interface TestResult {
  step: string;
  success: boolean;
  error?: string;
  data?: unknown;
  duration: number;
}

interface TestContext {
  sessionId?: string;
  cartId?: string;
  checkoutSessionId?: string;
  shippingMethodId?: string;
  orderId?: string;
  variantId?: string;
  results: TestResult[];
}

class CheckoutFlowTester {
  private db: ReturnType<typeof drizzle>;
  private results: TestResult[] = [];
  private context: TestContext = { results: [] };

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not set");
    }
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    this.db = drizzle(pool, { schema });
  }

  private async logStep(step: string, fn: () => Promise<unknown>): Promise<unknown> {
    const startTime = Date.now();
    try {
      console.log(`\n🔄 ${step}...`);
      const result = await fn();
      const duration = Date.now() - startTime;
      this.results.push({
        step,
        success: true,
        data: result,
        duration,
      });
      console.log(`✅ ${step} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({
        step,
        success: false,
        error: errorMessage,
        duration,
      });
      console.error(`❌ ${step} failed: ${errorMessage}`);
      throw error;
    }
  }

  private async httpRequest(
    method: string,
    endpoint: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
      query?: Record<string, string>;
    } = {},
  ): Promise<unknown> {
    const url = new URL(endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`);
    
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Add session ID cookie if available
    if (this.context.sessionId) {
      headers["Cookie"] = `session_id=${this.context.sessionId}`;
      headers["X-Session-Id"] = this.context.sessionId;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      if (isJson && typeof data === "object") {
        if ("message" in data) {
          errorMessage = String(data.message);
        } else if ("errors" in data && Array.isArray(data.errors)) {
          errorMessage = data.errors.join(", ");
        } else if ("error" in data) {
          errorMessage = String(data.error);
        }
        // Include full error details for debugging
        console.error("Error details:", JSON.stringify(data, null, 2));
      }
      throw new Error(errorMessage);
    }

    return data;
  }

  private async getTestVariant(): Promise<{ id: string; productId: string }> {
    const variants = await this.db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        inventory: productVariants.inventory,
      })
      .from(productVariants)
      .where(eq(productVariants.inventory, 100)) // Use variants with inventory
      .limit(1);

    if (variants.length === 0) {
      // Get any variant with inventory > 0
      const availableVariants = await this.db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
        })
        .from(productVariants)
        .limit(1);

      if (availableVariants.length === 0) {
        throw new Error("No product variants found in database. Please run seed script first.");
      }

      return availableVariants[0];
    }

    return variants[0];
  }

  async testGuestCheckoutFlow(): Promise<void> {
    console.log("\n🧪 Starting Guest Checkout Flow Test\n");
    console.log("=" .repeat(60));

    try {
      // Step 0: Generate unique session ID first
      this.context.sessionId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Step 1: Clear any existing cart/reservations
      await this.logStep("Clear Existing Cart/Reservations", async () => {
        try {
          // Try to clear cart - this will release reservations
          await this.httpRequest("POST", "/store/cart/reset");
          return { cleared: true };
        } catch (error) {
          // If cart doesn't exist or clear fails, that's okay
          // The error might be "cart not found" which is fine
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (errorMsg.includes("not found") || errorMsg.includes("empty")) {
            return { cleared: false, reason: "No existing cart" };
          }
          // Log but don't fail - we'll try to proceed anyway
          console.log(`⚠️  Warning: Could not clear cart: ${errorMsg}`);
          return { cleared: false, reason: errorMsg };
        }
      });

      // Step 2: Generate session ID (already done above, just log it)
      await this.logStep("Generate Session ID", async () => {
        return { sessionId: this.context.sessionId };
      });

      // Step 3: Get test variant
      await this.logStep("Get Test Product Variant", async () => {
        const variant = await this.getTestVariant();
        this.context.variantId = variant.id;
        return variant;
      });

      // Step 4: Get or create cart
      await this.logStep("Get or Create Cart", async () => {
        const cart = await this.httpRequest("GET", "/store/cart") as {
          id: string;
          items: unknown[];
        };
        this.context.cartId = cart.id;
        return cart;
      });

      // Step 5: Add item to cart
      await this.logStep("Add Item to Cart", async () => {
        if (!this.context.variantId) {
          throw new Error("Variant ID not set");
        }
        try {
          const result = await this.httpRequest("POST", "/store/cart/items", {
            body: {
              type: "variant",
              productVariantId: this.context.variantId,
              quantity: 1,
            },
          });
          return result;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          // If we hit the reservation limit, provide helpful error message
          if (errorMsg.includes("Maximum") && errorMsg.includes("reservations")) {
            console.log("\n⚠️  Reservation Limit Reached!");
            console.log("   The system allows a maximum of 3 active reservations per device.");
            console.log("   This is tracked by device fingerprint, not session ID.");
            console.log("\n   To resolve this:");
            console.log("   1. Complete or cancel existing orders/checkouts");
            console.log("   2. Clear your browser cookies/localStorage");
            console.log("   3. Wait a few minutes for reservations to expire");
            console.log("   4. Or run this test from a different device/browser\n");
            throw new Error(
              "Reservation limit reached. Please clear existing reservations or wait before retrying.",
            );
          }
          throw error;
        }
      });

      // Step 6: Verify cart has items
      await this.logStep("Verify Cart Has Items", async () => {
        const cart = await this.httpRequest("GET", "/store/cart") as {
          id: string;
          items: Array<{ id: string }>;
        };
        if (!cart.items || cart.items.length === 0) {
          throw new Error("Cart is empty after adding item");
        }
        this.context.cartId = cart.id;
        return cart;
      });

      // Step 7: Start checkout
      await this.logStep("Start Checkout Session", async () => {
        if (!this.context.cartId) {
          throw new Error("Cart ID not set");
        }
        const result = await this.httpRequest("POST", "/store/checkout/start", {
          body: {
            cartId: this.context.cartId,
            guestEmail: "test@example.com",
          },
        }) as { checkoutSessionId: string };
        this.context.checkoutSessionId = result.checkoutSessionId;
        return result;
      });

      // Step 8: Add shipping address
      await this.logStep("Add Shipping Address", async () => {
        if (!this.context.checkoutSessionId) {
          throw new Error("Checkout session ID not set");
        }
        const result = await this.httpRequest("POST", "/store/checkout/address", {
          body: {
            checkoutSessionId: this.context.checkoutSessionId,
            name: "Test User",
            email: "test@example.com",
            phone: "+919876543210",
            address1: "123 Test Street",
            address2: "Apt 4B",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
            country: "India",
          },
        });
        return result;
      });

      // Step 9: Get shipping methods
      await this.logStep("Get Shipping Methods", async () => {
        if (!this.context.checkoutSessionId) {
          throw new Error("Checkout session ID not set");
        }
        const result = await this.httpRequest("GET", "/store/checkout/shipping-methods", {
          query: {
            checkoutSessionId: this.context.checkoutSessionId,
            pincode: "400001",
            state: "Maharashtra",
          },
        }) as { methods: Array<{ id: string; name: string }> };
        
        if (!result.methods || result.methods.length === 0) {
          throw new Error("No shipping methods available");
        }
        this.context.shippingMethodId = result.methods[0].id;
        return result;
      });

      // Step 10: Select shipping method
      await this.logStep("Select Shipping Method", async () => {
        if (!this.context.checkoutSessionId || !this.context.shippingMethodId) {
          throw new Error("Checkout session ID or shipping method ID not set");
        }
        const result = await this.httpRequest("POST", "/store/checkout/shipping", {
          body: {
            checkoutSessionId: this.context.checkoutSessionId,
            shippingMethodId: this.context.shippingMethodId,
          },
        });
        return result;
      });

      // Step 11: Get payment methods
      await this.logStep("Get Payment Methods", async () => {
        if (!this.context.checkoutSessionId) {
          throw new Error("Checkout session ID not set");
        }
        const result = await this.httpRequest("GET", "/store/checkout/payment-methods", {
          query: {
            checkoutSessionId: this.context.checkoutSessionId,
          },
        }) as { methods: Array<{ method: string; fee: number }> };
        
        if (!result.methods || result.methods.length === 0) {
          throw new Error("No payment methods available");
        }
        return result;
      });

      // Step 12: Create order (COD)
      await this.logStep("Create Order (COD)", async () => {
        if (!this.context.checkoutSessionId) {
          throw new Error("Checkout session ID not set");
        }
        const result = await this.httpRequest("POST", "/store/orders", {
          body: {
            checkoutSessionId: this.context.checkoutSessionId,
            paymentMethodId: "COD",
          },
        }) as { orderId: string; orderNumber: string };
        
        this.context.orderId = result.orderId;
        return result;
      });

      // Step 13: Verify order was created
      await this.logStep("Verify Order Creation", async () => {
        if (!this.context.orderId) {
          throw new Error("Order ID not set");
        }
        const result = await this.httpRequest("GET", `/store/orders/${this.context.orderId}`);
        return result;
      });

      console.log("\n" + "=".repeat(60));
      console.log("✅ Guest Checkout Flow Test Completed Successfully!");
      this.printSummary();
    } catch (error) {
      console.log("\n" + "=".repeat(60));
      console.error("❌ Guest Checkout Flow Test Failed!");
      this.printSummary();
      throw error;
    }
  }

  async testAuthenticatedCheckoutFlow(): Promise<void> {
    console.log("\n🧪 Starting Authenticated Checkout Flow Test\n");
    console.log("=".repeat(60));
    console.log("⚠️  Authenticated checkout flow test requires authentication token");
    console.log("   This test is not fully implemented yet.");
    console.log("=".repeat(60));
  }

  private printSummary(): void {
    console.log("\n📊 Test Summary:");
    console.log("-".repeat(60));
    
    const successful = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Steps: ${this.results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);

    if (failed > 0) {
      console.log("\n❌ Failed Steps:");
      this.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - ${r.step}: ${r.error}`);
        });
    }

    console.log("\n📝 Step Details:");
    this.results.forEach((r, index) => {
      const icon = r.success ? "✅" : "❌";
      console.log(`${icon} [${index + 1}] ${r.step} (${r.duration}ms)`);
      if (!r.success && r.error) {
        console.log(`   Error: ${r.error}`);
      }
    });
  }

  async cleanup(): Promise<void> {
    // Close database connection
    // Note: drizzle doesn't expose a close method, but the pool will be garbage collected
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const testGuest = !args.includes("--authenticated") || args.includes("--guest");
  const testAuthenticated = args.includes("--authenticated");

  const tester = new CheckoutFlowTester();

  try {
    if (testGuest) {
      await tester.testGuestCheckoutFlow();
    }

    if (testAuthenticated) {
      await tester.testAuthenticatedCheckoutFlow();
    }
  } catch (error) {
    console.error("\n💥 Test execution failed:", error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { CheckoutFlowTester };
