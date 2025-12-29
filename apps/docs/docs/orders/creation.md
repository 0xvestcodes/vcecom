# Order Creation

## Overview

Orders are created through a two-phase process: **payment intent creation** during checkout, followed by **order finalization** via webhook after payment confirmation. The system supports both **authenticated checkout** (for registered customers) and **guest checkout** (for customers without accounts). Additionally, **Cash on Delivery (COD)** orders bypass payment intent creation and go directly to order creation.

## Order Creation Architecture

The order creation process is handled by specialized services:

- `OrderCreationService` - Coordinates creation flows
- `OrderPaymentIntentFlowService` - Handles payment intent creation
- `OrderPaymentFinalizationService` - Handles order creation from webhook
- `OrderCodFlowService` - Handles COD order creation

## Standard Order Flow (Payment Gateway)

### Phase 1: Payment Intent Creation

During checkout, the system creates a payment intent instead of creating an order immediately:

**Authenticated Checkout:**
1. Customer adds items to cart
2. Customer selects shipping/billing addresses
3. System orchestrates checkout setup (via `OrderCheckoutOrchestrationService`)
4. System processes cart items and calculates totals
5. System runs pricing engine to get effective prices
6. System applies discount engine to calculate discounts
7. System creates payment intent with Razorpay (via `OrderPaymentIntentService`)
8. System stores checkout metadata (customer, addresses, pricing/discount snapshots)
9. Customer completes payment at gateway

**Guest Checkout:**
1. Guest adds items to cart (using session ID)
2. Guest provides email, name, phone, and address during checkout
3. System creates customer record with `isGuest=true` (via `OrderCheckoutOrchestrationService`)
4. System creates addresses for guest customer
5. System processes cart items and calculates totals
6. System runs pricing and discount engines
7. System creates payment intent with Razorpay
8. System stores checkout metadata
9. Guest completes payment at gateway

### Phase 2: Order Finalization (Webhook-Driven)

Orders are created automatically when payment is confirmed via webhook:

1. Payment gateway sends webhook on payment capture
2. Webhook handler calls `OrderPaymentFinalizationService.finalizeOrderFromPayment()`
3. System checks payment-scoped idempotency (prevents duplicate orders)
4. System retrieves checkout session and metadata
5. System validates cart and cart items
6. System creates order record (via `OrderPersistenceService`)
7. System creates order items from cart
8. System commits inventory (releases reservations and decrements stock atomically)
9. System transitions checkout state to ORDER_CREATED
10. System clears cart
11. System sends order confirmation notification

## Payment Intent Creation

The `OrderPaymentIntentFlowService` handles payment intent creation. It orchestrates checkout setup, cart processing, pricing/discount engines, and payment intent creation.

### Service Flow

```typescript
// OrderPaymentIntentFlowService.createPaymentIntent()
async createPaymentIntent(
  userId: string | null,
  createOrderDto: CreateOrderDto,
  sessionId?: string | null,
): Promise<PaymentIntentResponseDto> {
  // 1. Orchestrate checkout setup (customer, addresses, cart)
  const checkoutSetup = await this.checkoutOrchestrationService
    .orchestrateCheckout(userId, createOrderDto, sessionId);
  
  // 2. Get or create checkout session
  const sessionResult = await this.checkoutSessionService
    .getOrCreateSession(cartId, createOrderDto.checkoutSessionId);
  
  // 3. Extract and process cart items
  const cartItems = await this.cartProcessingService.extractCartItems(cartItemIds);
  
  // 4. Calculate totals (GST, shipping, etc.)
  const totals = await this.calculationService.calculateOrderTotals(...);
  
  // 5. Run pricing engine to get effective prices
  const pricingResult = await this.pricingEngineService.runPricingEngine(...);
  
  // 6. Apply discount engine
  const discountResult = await this.discountEngineService.applyDiscounts(...);
  
  // 7. Check for COD payment method
  if (isCodPayment(paymentMethod)) {
    // COD flow - create order directly
    return await this.codFlowService.createCodOrder(...);
  }
  
  // 8. Store checkout metadata
  await this.metadataService.createAndStoreMetadata(checkoutSessionId, {...});
  
  // 9. Create payment intent
  const paymentIntent = await this.paymentIntentService.createPaymentIntent(...);
  
  return { paymentIntent, checkoutSessionId, message: "..." };
}
```

### Authenticated Request

```http
POST /orders
Authorization: Bearer {token}
Content-Type: application/json

{
  "shippingAddressId": "uuid",
  "billingAddressId": "uuid",
  "shippingCost": 50.0
}
```

**Response:**
```json
{
  "paymentIntent": {
    "paymentProvider": "razorpay",
    "paymentIntentId": "order_abc123",
    "status": "created",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  },
  "checkoutSessionId": "session-123",
  "message": "Payment intent created. Redirect user to payment gateway."
}
```

### Guest Request

```http
POST /orders
X-Session-Id: {session-id}
Content-Type: application/json

{
  "email": "guest@example.com",
  "name": "Guest User",
  "phone": "+919876543210",
  "address": {
    "type": "shipping",
    "street": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "district": "Mumbai",
    "country": "India"
  },
  "password": "SecurePassword123!",
  "shippingCost": 50.0
}
```

**Note:** The `password` field is optional. If provided, creates an account instead of guest checkout.

**Response:** Same as authenticated checkout.

## Order Finalization from Webhook

Orders are created automatically when payment is confirmed via webhook. The `OrderPaymentFinalizationService` handles this process.

### Service Flow

```typescript
// OrderPaymentFinalizationService.finalizeOrderFromPayment()
async finalizeOrderFromPayment(
  checkoutSessionId: string,
  paymentIntentId: string,
  provider: string = "razorpay",
): Promise<OrderResponseDto> {
  // 1. Check payment-scoped idempotency
  const existingOrder = await this.idempotencyService.checkExistingOrder(
    checkoutSessionId, paymentIntentId, provider
  );
  if (existingOrder) return existingOrder;
  
  // 2. Get checkout session and validate state
  const session = await this.checkoutSessionService.getSession(
    checkoutSessionId, CheckoutState.PAYMENT_CONFIRMED
  );
  
  // 3. Get checkout metadata
  const metadata = await this.checkoutSessionService.getMetadata(checkoutSessionId);
  
  // 4. Validate cart and get cart items
  const cart = await this.cartsService.getCartById(session.cartId);
  const cartItems = await this.cartValidationService.validateAndFetchCartItems(...);
  
  // 5. Calculate totals and validate snapshots
  const totals = await this.totalsCalculationService.calculateTotalsFromCartItems(...);
  const pricingValidation = await this.snapshotValidationService
    .validatePricingSnapshot(checkoutSessionId, metadata.pricingSnapshot, subtotal);
  
  // 6. Persist order
  const persistedOrder = await this.persistenceService.persistOrder(customerId, {...});
  
  // 7. Persist order items
  await this.persistenceService.persistOrderItems(orderId, variantItems, bundleItems, ...);
  
  // 8. Commit inventory atomically (CRITICAL)
  await this.inventoryService.commitOrderInventory(cart.id, orderId, variantItems, bundleItems, true);
  
  // 9. Transition checkout state
  await this.stateTransitionService.completeOrderTransitions(checkoutSessionId, orderId);
  
  // 10. Clear cart
  await this.cartCleanupService.clearCartById(session.cartId);
  
  // 11. Send notification
  await this.notificationService.sendOrderConfirmation(...);
  
  return orderResponse;
}
```

### Inventory Commit During Order Creation

**CRITICAL**: Inventory is committed atomically using a Lua script in `OrderInventoryService.commitOrderInventory()`:

```typescript
// OrderInventoryService.commitOrderInventory()
// Uses atomic Lua script to:
// 1. Release all cart reservations
// 2. Decrement inventory for variant items
// 3. Decrement inventory for bundle items (all variants)
// All operations happen atomically - either all succeed or all fail

await this.inventoryStore.commitOrderInventory(
  cartId,
  orderId,
  variantItems.map(item => ({
    productVariantId: item.productVariantId,
    quantity: item.quantity,
  })),
  bundleItems,
  clearCheckoutLock, // true for payment gateway orders
);
```

**Important Notes:**
- Inventory commit happens **atomically** at order creation, not at delivery
- Uses Lua script to ensure consistency (all-or-nothing)
- If inventory commit fails, order creation fails (transaction rollback)
- Failed commits are logged as **CRITICAL** errors
- Manual reconciliation required for failed commits (see [Inventory Reconciliation](./inventory-reconciliation))

### Checkout Metadata

The checkout metadata stored during payment intent creation includes:

```typescript
{
  customerId: string;      // Required - customer ID (guest or authenticated)
  userId: string | null;   // Optional - null for guests
  shippingAddressId: string;
  billingAddressId: string;
  shippingCost: number;
  discountSnapshot: DiscountSnapshot | null;
  pricingSnapshot: PricingSnapshot | null;
  createdAt: string;
}
```

**Key Point:** Orders are linked to `customerId`, not `userId`. This allows both guest and authenticated customers to have orders.

## Customer Linking

### Authenticated Customers

- Orders linked via `customerId` (derived from `userId`)
- Customer can view orders via `/orders` endpoint
- Full order history available

### Guest Customers

- Orders linked via `customerId` (created during checkout)
- Guest cannot access `/orders` endpoint (requires authentication)
- Orders visible in admin panel
- Guest can claim account later to access orders

## Account Claiming

After guest checkout, customers can claim their account:

```http
POST /customers/claim
Content-Type: application/json

{
  "email": "guest@example.com",
  "token": "verification-token",
  "newPassword": "SecurePassword123!"
}
```

This converts the guest customer to a regular account:
- Sets `isGuest=false`
- Sets `emailVerified=true`
- Updates `passwordHash` in user record
- Customer can now login and access orders

## Cash on Delivery (COD) Flow

COD orders bypass payment intent creation and go directly to order creation. The `OrderCodFlowService` handles this specialized flow.

### COD Detection

During payment intent creation, the system detects COD payment method:

```typescript
// In OrderPaymentIntentFlowService.createPaymentIntent()
const isCod = isCodPayment(paymentMethod); // Checks if paymentMethod === "cod"

if (isCod) {
  // Store checkout metadata first
  await this.checkoutStore.storeCheckoutMetadata(checkoutSessionId, checkoutMetadata);
  
  // Create COD order directly
  const codOrder = await this.codFlowService.createCodOrder(
    checkoutSessionId, userId, createOrderDto, sessionId
  );
  
  // Return response with order details (no payment intent for COD)
  return {
    paymentIntent: {
      paymentProvider: "cod",
      paymentIntentId: `cod-${codOrder.id}`,
      status: PaymentIntentStatus.CREATED,
    },
    checkoutSessionId,
    orderId: codOrder.id, // Include order ID for COD orders
    message: "COD order created successfully",
  };
}
```

### COD Order Creation Flow

```typescript
// OrderCodFlowService.createCodOrder()
async createCodOrder(
  checkoutSessionId: string,
  userId: string | null,
  createOrderDto: CreateOrderDto,
  sessionId: string | null,
): Promise<OrderResponseDto> {
  // 1. Get checkout session and validate state (LOCKED)
  const session = await this.checkoutSessionService.getSession(
    checkoutSessionId, CheckoutState.LOCKED
  );
  
  // 2. Get checkout metadata and verify COD payment method
  const metadata = await this.checkoutSessionService.getMetadata(checkoutSessionId);
  if (!isCodPayment(metadata.paymentMethod)) {
    throw new BadRequestException("Expected COD payment method");
  }
  
  // 3. Process cart items and calculate totals
  const cart = await this.cartsService.getCartById(session.cartId);
  const cartItems = await this.cartProcessingService.extractCartItems(...);
  const totals = await this.calculationService.calculateOrderTotals(...);
  
  // 4. Validate pricing and discount snapshots
  const pricingValidation = await this.snapshotValidationService
    .validatePricingSnapshot(checkoutSessionId, metadata.pricingSnapshot, subtotal);
  
  // 5. Persist order
  const persistedOrder = await this.persistenceService.persistOrder(customerId, {...});
  
  // 6. Persist order items
  await this.persistenceService.persistOrderItems(orderId, variantItems, bundleItems, ...);
  
  // 7. Commit inventory atomically
  await this.inventoryService.commitOrderInventory(
    cart.id, orderId, variantItems, bundleItems, false // Don't clear checkout lock
  );
  
  // 8. Create COD payment record
  await this.persistenceService.createCodPayment(orderId, total);
  
  // 9. Transition checkout state (LOCKED → PAYMENT_CONFIRMED → ORDER_CREATED → COMPLETED)
  await this.stateTransitionService.completeCodOrderTransitions(checkoutSessionId, orderId);
  
  // 10. Clear cart
  await this.cartCleanupService.clearCartById(session.cartId);
  
  // 11. Send notification
  await this.notificationService.sendOrderConfirmation(...);
  
  return orderResponse;
}
```

### COD State Transitions

COD orders follow a different state transition path:

```
LOCKED → PAYMENT_CONFIRMED → ORDER_CREATED → COMPLETED
```

COD selection is equivalent to payment confirmation (commitment to pay on delivery).

### COD Response

When COD is detected, the response includes the order ID:

```json
{
  "paymentIntent": {
    "paymentProvider": "cod",
    "paymentIntentId": "cod-order-123",
    "status": "created"
  },
  "checkoutSessionId": "session-123",
  "orderId": "order-123",
  "message": "COD order created successfully"
}
```

## Order Data

All orders contain:

- **Customer Information**: Linked via `customerId` (from checkout metadata)
- **Shipping Address**: From checkout metadata
- **Billing Address**: From checkout metadata
- **Pricing Snapshot**: Immutable pricing at time of checkout
- **Discount Snapshot**: Immutable discounts at time of checkout
- **Order Items**: Cart items at time of checkout
- **Payment Information**: Payment intent ID (or COD payment record)
- **Payment Method**: Payment method used (e.g., "cod", "card", "upi")

## Idempotency

Order creation is idempotent:

- **Payment-scoped idempotency**: Prevents duplicate orders from same payment intent
- Same payment intent cannot create multiple orders
- Webhook retries are safe (idempotency check happens first)
- COD orders use checkout session idempotency

### Idempotency Implementation

```typescript
// OrderIdempotencyService.checkExistingOrder()
// Checks if order already exists for this payment intent
const existingOrder = await this.idempotencyService.checkExistingOrder(
  checkoutSessionId,
  paymentIntentId,
  provider,
);

if (existingOrder) {
  // Order already exists, return it
  return existingOrder;
}
```

## Error Handling

### Common Errors

**Empty Cart**
```json
{
  "statusCode": 400,
  "message": "Cart is empty"
}
```

**Missing Required Fields (Guest)**
```json
{
  "statusCode": 400,
  "message": "Email, name, phone, and address are required for guest checkout"
}
```

**Missing Session ID (Guest)**
```json
{
  "statusCode": 400,
  "message": "Session ID is required for guest checkout"
}
```

**Email Already Registered**
```json
{
  "statusCode": 400,
  "message": "Email already registered. Please login to continue."
}
```

## Best Practices

1. **Guest Checkout**: Always collect email early in the process
2. **Session Management**: Maintain session ID throughout guest checkout
3. **Account Upsell**: Offer account creation during checkout
4. **Post-Purchase**: Send claim account email after guest checkout
5. **Order Tracking**: Provide order lookup by email + order ID for guests

