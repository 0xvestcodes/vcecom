# Phase 4: OrderCreationService Decomposition - Extraction Plan

## Current State
- `order-creation.service.ts`: 2,912 lines (6x over limit)
- Still contains multiple responsibilities that can be further decomposed

## Extraction Strategy

### Step 1: Extract Order Payment Intent Service (~400-500 lines)
**File**: `services/order-payment-intent.service.ts`
**Extract from**: `create()` method
**Responsibilities**:
- Create payment intents via PaymentsService
- Handle payment intent responses
- Validate payment intent amounts
- Store payment intent in checkout metadata

**Methods to extract**:
- `createPaymentIntent()` - Create payment intent for checkout
- `validatePaymentIntentAmount()` - Validate payment intent amount matches calculated total
- `storePaymentIntentMetadata()` - Store payment intent in checkout session

### Step 2: Extract Order Persistence Service (~300-400 lines)
**File**: `services/order-persistence.service.ts`
**Extract from**: `createCodOrder()`, `finalizeOrderFromPayment()`
**Responsibilities**:
- Persist orders to database
- Persist order items to database
- Generate order numbers
- Handle order ID mapping

**Methods to extract**:
- `persistOrder()` - Save order to database
- `persistOrderItems()` - Save order items to database
- `generateOrderNumber()` - Generate unique order number
- `mapOrderId()` - Map order ID for idempotency

### Step 3: Extract Order Cart Processing Service (~400-500 lines)
**File**: `services/order-cart-processing.service.ts`
**Extract from**: `create()`, `createCodOrder()`, `finalizeOrderFromPayment()`
**Responsibilities**:
- Extract cart items from cart
- Separate bundle and variant items
- Fetch product/variant data for cart items
- Process bundle items and extract variant quantities

**Methods to extract**:
- `extractCartItems()` - Get cart items with metadata
- `separateBundleAndVariantItems()` - Separate bundle and variant cart items
- `fetchCartItemProductData()` - Fetch product/variant data for cart items
- `processBundleItems()` - Process bundle items and extract variant quantities
- `fetchProductCollectionsAndTags()` - Fetch collections and tags for pricing

### Step 4: Extract Order Checkout Session Service (~200-300 lines)
**File**: `services/order-checkout-session.service.ts`
**Extract from**: `create()`, `createCodOrder()`, `finalizeOrderFromPayment()`
**Responsibilities**:
- Manage checkout session state transitions
- Store and retrieve checkout metadata
- Handle checkout locks
- Validate checkout session state

**Methods to extract**:
- `acquireCheckoutLock()` - Acquire checkout lock for cart
- `releaseCheckoutLock()` - Release checkout lock
- `getOrCreateCheckoutSession()` - Get or create checkout session
- `transitionCheckoutState()` - Transition checkout session state
- `storeCheckoutMetadata()` - Store checkout metadata
- `validateCheckoutState()` - Validate checkout session state

### Step 5: Extract Order Calculation Service (~300-400 lines)
**File**: `services/order-calculation.service.ts`
**Extract from**: `create()`, `createCodOrder()`, `finalizeOrderFromPayment()`
**Responsibilities**:
- Calculate order totals (subtotal, GST, shipping, total)
- Calculate GST breakdown (CGST, SGST, IGST)
- Apply discounts from snapshots
- Calculate bundle pricing

**Methods to extract**:
- `calculateOrderTotals()` - Calculate order totals from cart items
- `calculateGstBreakdown()` - Calculate GST breakdown for order
- `applyDiscountSnapshot()` - Apply discount snapshot to order
- `calculateBundleTotals()` - Calculate totals for bundle items

### Step 6: Refactor OrderCreationService to Orchestrator
**File**: `order-creation.service.ts` (reduce to <500 lines)
**Responsibilities**:
- Orchestrate order creation flow
- Coordinate between specialized services
- Handle guest vs authenticated checkout flows
- Provide unified API

## Dependencies Between Services

```
OrderCreationService (orchestrator)
├── OrderPaymentIntentService
├── OrderPersistenceService
├── OrderCartProcessingService
├── OrderCheckoutSessionService
├── OrderCalculationService
├── OrderInventoryService (existing)
├── OrderDiscountService (existing)
├── OrderValidationService (existing)
├── OrderPricingService (existing)
└── OrderGstService (existing)
```

## Execution Order
1. OrderCheckoutSessionService (foundation, used by all flows)
2. OrderCartProcessingService (used by all order creation flows)
3. OrderCalculationService (used by all order creation flows)
4. OrderPaymentIntentService (used by create() flow)
5. OrderPersistenceService (used by createCodOrder() and finalizeOrderFromPayment())
6. Refactor OrderCreationService to orchestrator

## Target Metrics
- OrderCreationService: <500 lines (down from 2,912 lines)
- Each extracted service: <500 lines
- All services follow single responsibility principle
