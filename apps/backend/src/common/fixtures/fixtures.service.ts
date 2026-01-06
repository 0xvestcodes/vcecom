import { Inject, Injectable } from "@nestjs/common";
import {
  addresses,
  categories,
  customers,
  orderItems,
  orderStatusEnum,
  orders,
  products,
  productVariants,
  stores,
  users,
} from "@vcecom/db";
import * as bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";

/**
 * Fixtures Service
 * Provides methods to create test data fixtures for development and testing
 */
@Injectable()
export class FixturesService {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  /**
   * Get default store ID helper
   */
  private async getDefaultStoreId(): Promise<string> {
    const [defaultStore] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.isDefault, true))
      .limit(1);

    if (defaultStore) {
      return defaultStore.id;
    }

    const [firstStore] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .limit(1);
    if (firstStore) {
      return firstStore.id;
    }

    // If no store exists, create a default one
    const [newStore] = await this.db
      .insert(stores)
      .values({
        name: "Default Store",
        domain: "localhost",
        currency: "INR",
        isDefault: true,
      })
      .returning();

    return newStore.id;
  }

  /**
   * Create a complete test store setup
   */
  async createTestStore(overrides?: {
    storeName?: string;
    storeDomain?: string;
  }) {
    const [store] = await this.db
      .insert(stores)
      .values({
        name: overrides?.storeName || "Test Store",
        domain: overrides?.storeDomain || "test.localhost",
        currency: "INR",
        isDefault: true,
      })
      .returning();

    return store;
  }

  /**
   * Create a test user
   */
  async createTestUser(overrides?: {
    email?: string;
    password?: string;
    role?: "admin" | "customer" | "support" | "reviewer" | "marketing";
  }) {
    const email = overrides?.email || `test-${Date.now()}@example.com`;
    const password = overrides?.password || "Test@123";
    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await this.db
      .insert(users)
      .values({
        email,
        passwordHash,
        role: overrides?.role || "customer",
      })
      .returning();

    return { ...user, password }; // Return password for testing
  }

  /**
   * Create a test customer with user
   */
  async createTestCustomer(overrides?: {
    email?: string;
    name?: string;
    phone?: string;
  }) {
    const email = overrides?.email || `customer-${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash("Test@123", 10);

    const [user] = await this.db
      .insert(users)
      .values({
        email,
        passwordHash,
        role: "customer",
      })
      .returning();

    const storeId = await this.getDefaultStoreId();
    const [customer] = await this.db
      .insert(customers)
      .values({
        userId: user.id,
        storeId,
        email,
        name: overrides?.name || "Test Customer",
        phone: overrides?.phone || "9876543210",
        isGuest: false,
        emailVerified: true,
      })
      .returning();

    return { user, customer };
  }

  /**
   * Create a test category
   */
  async createTestCategory(overrides?: {
    name?: string;
    slug?: string;
    parentId?: string;
  }) {
    const name = overrides?.name || `Category ${Date.now()}`;
    const slug =
      overrides?.slug ||
      name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

    const storeId = await this.getDefaultStoreId();
    const [category] = await this.db
      .insert(categories)
      .values({
        name,
        storeId,
        slug,
        parentId: overrides?.parentId || null,
        description: `Test category: ${name}`,
      })
      .returning();

    return category;
  }

  /**
   * Create a test product with variant
   */
  async createTestProduct(overrides?: {
    title?: string;
    categoryId?: string;
    price?: number;
    inventory?: number;
  }) {
    const title = overrides?.title || `Product ${Date.now()}`;
    const price = overrides?.price || 999;

    const storeId = await this.getDefaultStoreId();
    const [product] = await this.db
      .insert(products)
      .values({
        storeId,
        title,
        description: `Test product: ${title}`,
        price,
        gstRate: 12,
        pricingType: "exclusive",
        hsnCode: "6109",
        status: "active",
        categoryId: overrides?.categoryId || null,
        isDigital: false,
        isPreorder: false,
      })
      .returning();

    const [variant] = await this.db
      .insert(productVariants)
      .values({
        productId: product.id,
        sku: `SKU-${Date.now()}`,
        price,
        currency: "INR",
        inventory: overrides?.inventory || 100,
      })
      .returning();

    return { product, variant };
  }

  /**
   * Create a test address
   */
  async createTestAddress(
    customerId: string,
    overrides?: Partial<typeof addresses.$inferInsert>,
  ) {
    const [address] = await this.db
      .insert(addresses)
      .values({
        customerId,
        type: overrides?.type || "both",
        street: overrides?.street || "123 Test Street",
        city: overrides?.city || "Bangalore",
        state: overrides?.state || "Karnataka",
        pincode: overrides?.pincode || "560001",
        country: overrides?.country || "India",
        district: overrides?.district || "Bangalore Urban",
        isDefault: overrides?.isDefault || true,
      })
      .returning();

    return address;
  }

  /**
   * Create a test order
   */
  async createTestOrder(overrides?: {
    customerId?: string;
    status?: string;
    total?: number;
  }) {
    // Create customer if not provided
    let customerId = overrides?.customerId;
    if (!customerId) {
      const { customer } = await this.createTestCustomer();
      customerId = customer.id;
    }

    // Get or create address
    const addressesList = await this.db
      .select()
      .from(addresses)
      .where(eq(addresses.customerId, customerId))
      .limit(1);

    let addressId: string;
    if (addressesList.length === 0) {
      const address = await this.createTestAddress(customerId);
      addressId = address.id;
    } else {
      addressId = addressesList[0].id;
    }

    const total = overrides?.total || 1000;
    const subtotal = total * 0.9;
    const gstAmount = total * 0.1;
    const shippingCost = 50;

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const orderResult = await this.db
      .insert(orders)
      .values({
        customerId,
        orderNumber,
        status:
          (overrides?.status as
            | (typeof orderStatusEnum.enumValues)[number]
            | undefined) || "pending",
        subtotal,
        gstAmount,
        shippingCost,
        total,
        shippingAddressId: addressId,
        billingAddressId: addressId,
      })
      .returning();
    const order = orderResult[0];

    return order;
  }

  /**
   * Create a complete test scenario (store, products, customers, orders)
   */
  async createTestScenario() {
    const store = await this.createTestStore();
    const category = await this.createTestCategory();
    const { product, variant } = await this.createTestProduct({
      categoryId: category.id,
    });
    const { customer } = await this.createTestCustomer();
    const address = await this.createTestAddress(customer.id);
    const order = await this.createTestOrder({ customerId: customer.id });

    // Add order item
    const [orderItem] = await this.db
      .insert(orderItems)
      .values({
        orderId: order.id,
        productVariantId: variant.id,
        quantity: 1,
        price: variant.price,
        gstRate: 12,
        gstAmount: (variant.price * 12) / 100,
      })
      .returning();

    return {
      store,
      category,
      product,
      variant,
      customer,
      address,
      order,
      orderItem,
    };
  }

  /**
   * Clean up test data (use with caution!)
   */
  async cleanupTestData() {
    // This should be used carefully - only in test environments
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cannot cleanup test data in production");
    }

    // Delete in reverse order of dependencies
    await this.db.delete(orderItems);
    await this.db.delete(orders);
    await this.db.delete(addresses);
    await this.db.delete(customers);
    await this.db.delete(productVariants);
    await this.db.delete(products);
    await this.db.delete(categories);
    await this.db.delete(users);
    await this.db.delete(stores);
  }
}
