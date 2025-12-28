# Order Creation

## Overview

Orders are created through the checkout process. The system supports both **authenticated checkout** (for registered customers) and **guest checkout** (for customers without accounts).

## Order Creation Flow

### Authenticated Checkout

For authenticated customers:

1. Customer adds items to cart
2. Customer selects shipping/billing addresses
3. System creates payment intent
4. Customer completes payment
5. Webhook creates order from payment confirmation

### Guest Checkout

For guest customers:

1. Guest adds items to cart (using session ID)
2. Guest provides email, name, phone, and address during checkout
3. System creates customer record with `isGuest=true`
4. System creates addresses for guest customer
5. System creates payment intent
6. Guest completes payment
7. Webhook creates order from payment confirmation

## Payment Intent Creation

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

## Order Creation from Webhook

Orders are created automatically when payment is confirmed via webhook:

1. Payment webhook received
2. System retrieves checkout metadata (includes `customerId`)
3. System creates order linked to `customerId`
4. **System commits inventory (decrements stock)** - happens immediately after order creation
5. System clears cart

### Inventory Commit During Order Creation

**CRITICAL**: Inventory is decremented immediately when the order is created in `finalizeOrderFromPayment`:

```typescript
// In finalizeOrderFromPayment, after order creation:
try {
  // Release all cart reservations
  await this.inventoryStore.releaseCartReservations(cart.id);

  // Commit inventory for variant items (decrement stock)
  for (const item of cartItemsWithVariants) {
    await this.inventoryStore.incrementInventory(
      item.productVariantId,
      -item.quantity, // Negative to decrement
    );
  }

  // Commit inventory for bundle items (all variants)
  for (const bundleItem of bundleCartItems) {
    const variantQuantities = flattenBundleSelections(
      bundleMetadata.selections,
      bundleItem.quantity,
    );

    for (const vq of variantQuantities) {
      await this.inventoryStore.incrementInventory(
        vq.variantId,
        -vq.quantity, // Negative to decrement
      );
    }
  }
} catch (error) {
  // CRITICAL ERROR: Inventory commit failed
  // Order is already created, but inventory wasn't decremented
  // Requires manual reconciliation
  logger.error("CRITICAL: Failed to commit inventory for order", {
    orderId,
    error,
    critical: true,
  });
}
```

**Important Notes:**
- Inventory decrement happens **at order creation**, not at delivery
- If inventory commit fails, order is still created (payment was successful)
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

## Order Data

All orders contain:

- **Customer Information**: Linked via `customerId`
- **Shipping Address**: From checkout metadata
- **Billing Address**: From checkout metadata
- **Pricing Snapshot**: Immutable pricing at time of checkout
- **Discount Snapshot**: Immutable discounts at time of checkout
- **Order Items**: Cart items at time of checkout
- **Payment Information**: Payment intent and transaction details

## Idempotency

Order creation is idempotent:

- Payment-scoped idempotency prevents duplicate orders
- Same payment intent cannot create multiple orders
- Webhook retries are safe

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

