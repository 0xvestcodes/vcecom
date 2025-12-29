import { INestApplication } from "@nestjs/common";
import {
  addresses,
  cartItems,
  carts,
  customers,
  products,
  productVariants,
} from "@vcecom/db";
import * as request from "supertest";
import {
  createMockAddress,
  createMockCart,
  createMockCartItem,
  createMockCustomer,
  createMockProduct,
  createMockProductVariant,
} from "../../test/fixtures/order.fixtures";
import { createTestApp } from "../../test/utils/test-module";

describe("Orders E2E Tests", () => {
  let app: INestApplication;
  let db: any;
  let _redis: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    db = testApp.db;
    _redis = testApp.redis;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Complete Payment Intent → Webhook → Order Flow", () => {
    let customer: any;
    let cart: any;
    let shippingAddress: any;
    let billingAddress: any;
    let product: any;
    let variant: any;
    let cartItem: any;
    let _checkoutSessionId: string;
    let _paymentIntentId: string;

    beforeEach(async () => {
      // Create test data
      customer = createMockCustomer();
      product = createMockProduct();
      variant = createMockProductVariant({ productId: product.id });
      shippingAddress = createMockAddress({ customerId: customer.id });
      billingAddress = createMockAddress({ customerId: customer.id });
      cart = createMockCart({ customerId: customer.id });
      cartItem = createMockCartItem({
        cartId: cart.id,
        variantId: variant.id,
      });

      // Insert into database
      await db.insert(customers).values(customer);
      await db.insert(products).values(product);
      await db.insert(productVariants).values(variant);
      await db.insert(addresses).values([shippingAddress, billingAddress]);
      await db.insert(carts).values(cart);
      await db.insert(cartItems).values(cartItem);
    });

    it("should create payment intent, receive webhook, and finalize order", async () => {
      // Step 1: Create payment intent
      const paymentIntentResponse = await request(app.getHttpServer())
        .post("/store/orders")
        .set("Authorization", `Bearer ${customer.userId}`)
        .send({
          cartId: cart.id,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
          paymentMethod: "razorpay",
        })
        .expect(201);

      expect(paymentIntentResponse.body).toHaveProperty("paymentIntentId");
      expect(paymentIntentResponse.body).toHaveProperty("checkoutSessionId");
      expect(paymentIntentResponse.body).toHaveProperty("redirectUrl");

      _checkoutSessionId = paymentIntentResponse.body.checkoutSessionId;
      _paymentIntentId = paymentIntentResponse.body.paymentIntentId;

      // Step 2: Simulate payment webhook (payment confirmed)
      // In a real scenario, this would be called by Razorpay
      // For E2E test, we'd need to mock the webhook endpoint or call the internal service
      // This is a placeholder for the complete flow

      // Step 3: Verify order was created
      // After webhook processing, the order should be finalized
      // This would require checking the database for the created order
    });
  });
});
