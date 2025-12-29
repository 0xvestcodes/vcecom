// Simple mock data generators for tests
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function randomFloat(min: number, max: number, precision = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(precision));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAlphanumeric(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const createMockOrder = (overrides?: Partial<any>) => ({
  id: generateUUID(),
  customerId: generateUUID(),
  orderNumber: `ORD-${randomAlphanumeric(10)}`,
  status: "pending",
  subtotal: randomFloat(100, 10000),
  gstAmount: randomFloat(0, 1000),
  shippingCost: randomFloat(0, 500),
  paymentFee: randomFloat(0, 100),
  paymentMethod: "razorpay",
  total: randomFloat(100, 10000),
  razorpayOrderId: `order_${randomAlphanumeric(14)}`,
  shippingAddressId: generateUUID(),
  billingAddressId: generateUUID(),
  discountCode: null,
  discountAmount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  archived: false,
  archivedAt: null,
  archivedBy: null,
  ...overrides,
});

export const createMockOrderItem = (overrides?: Partial<any>) => ({
  id: generateUUID(),
  orderId: generateUUID(),
  productVariantId: generateUUID(),
  quantity: randomInt(1, 10),
  price: randomFloat(10, 1000),
  gstRate: randomFloat(0, 28),
  gstAmount: randomFloat(0, 100),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockPaymentIntent = (overrides?: Partial<any>) => ({
  paymentIntentId: `order_${randomAlphanumeric(14)}`,
  status: "created",
  provider: "razorpay",
  amount: randomInt(10000, 1000000),
  currency: "INR",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockCheckoutSession = (overrides?: Partial<any>) => ({
  id: generateUUID(),
  cartId: generateUUID(),
  state: "LOCKED",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockCart = (overrides?: Partial<any>) => ({
  id: generateUUID(),
  customerId: generateUUID(),
  items: [createMockCartItem(), createMockCartItem()],
  discountCode: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockCartItem = (overrides?: Partial<any>) => ({
  id: generateUUID(),
  cartId: generateUUID(),
  productVariantId: generateUUID(),
  quantity: randomInt(1, 5),
  price: randomFloat(100, 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockProductVariant = (overrides?: Partial<any>) => ({
  id: generateUUID(),
  productId: generateUUID(),
  sku: `SKU-${randomAlphanumeric(8)}`,
  price: randomFloat(100, 1000),
  compareAtPrice: randomFloat(1000, 2000),
  salePrice: null,
  saleStartDate: null,
  saleEndDate: null,
  inventory: randomInt(0, 100),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockProduct = (overrides?: Partial<any>) => ({
  id: generateUUID(),
  title: `Product ${randomAlphanumeric(5)}`,
  gstRate: randomFloat(0, 28),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockCustomer = (overrides?: Partial<any>) => ({
  id: generateUUID(),
  userId: generateUUID(),
  email: `test${randomAlphanumeric(5)}@example.com`,
  customerGroupId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockAddress = (overrides?: Partial<any>) => ({
  id: generateUUID(),
  customerId: generateUUID(),
  street: `Street ${randomInt(1, 100)}`,
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560001",
  country: "India",
  district: "Bangalore Urban",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockPayment = (overrides?: Partial<any>) => ({
  id: generateUUID(),
  orderId: generateUUID(),
  amount: randomInt(10000, 1000000),
  method: "razorpay",
  status: "pending",
  razorpayPaymentId: `pay_${randomAlphanumeric(14)}`,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockRefund = (overrides?: Partial<any>) => ({
  id: generateUUID(),
  orderId: generateUUID(),
  amount: randomFloat(100, 1000),
  reason: "Customer request",
  status: "pending",
  providerRefundId: null,
  processedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
