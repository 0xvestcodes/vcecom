# Phase 3: Orders Module Decomposition - Extraction Plan

## Current State
- `orders.service.ts`: 4,496 lines (9x over limit)
- `order-timeline.service.ts`: 765 lines (needs split)

## Extraction Strategy

### Step 1: Extract Order Inventory Service (~200 lines)
**File**: `services/order-inventory.service.ts`
**Extract from**: `createCodOrder()` and `finalizeOrderFromPayment()`
**Responsibilities**:
- Commit inventory reservations atomically
- Sync inventory to database
- Handle reservation mode detection (hard/soft)
- Bundle inventory commitment

**Methods to extract**:
- `commitOrderInventory()` - Commit reservations for order items
- `commitBundleInventory()` - Commit reservations for bundle items
- `syncInventoryToDatabase()` - Sync Redis inventory to DB

### Step 2: Extract Order Discount Service (~300 lines)
**File**: `services/order-discount.service.ts`
**Extract from**: `create()`, `createCodOrder()`, `finalizeOrderFromPayment()`
**Responsibilities**:
- Run discount engine
- Validate discount snapshots
- Apply discounts to orders
- Handle discount drift detection

**Methods to extract**:
- `applyDiscountsToOrder()` - Run discount engine and apply discounts
- `validateDiscountSnapshot()` - Validate discount snapshot integrity
- `detectDiscountDrift()` - Detect discount drift between creation and finalization

### Step 3: Extract Order Enrichment Service (~400 lines)
**File**: `services/order-enrichment.service.ts`
**Extract from**: `findOne()`, `findOnePublic()`, `findAll()`
**Responsibilities**:
- Enrich order items with product data
- Enrich orders with addresses
- Calculate GST breakdowns for display
- Format order responses

**Methods to extract**:
- `enrichOrderItems()` - Enrich order items with variant/product data
- `enrichOrderAddresses()` - Fetch and enrich addresses
- `calculateOrderGstBreakdown()` - Calculate GST for order display
- `formatOrderResponse()` - Format order for API response

### Step 4: Extract Order Query Service (~600 lines)
**File**: `services/order-query.service.ts`
**Extract from**: `findOne()`, `findOnePublic()`, `findAll()`
**Responsibilities**:
- Query orders from database
- Filter orders by status, customer, etc.
- Handle order access control
- Pagination and sorting

**Methods to extract**:
- `findOrderById()` - Get order by ID with access control
- `findOrdersByCustomer()` - List orders for customer
- `findPublicOrder()` - Public order lookup by order number
- `buildOrderQuery()` - Build query conditions

### Step 5: Extract Order Creation Service (~800 lines)
**File**: `services/order-creation.service.ts`
**Extract from**: `create()`, `createCodOrder()`, `finalizeOrderFromPayment()`
**Responsibilities**:
- Create payment intents
- Create COD orders
- Finalize orders from payment webhooks
- Handle guest vs authenticated checkout
- Order persistence

**Methods to extract**:
- `createPaymentIntent()` - Create payment intent for checkout
- `createCodOrder()` - Create COD order directly
- `finalizeOrderFromPayment()` - Finalize order from payment webhook
- `persistOrder()` - Save order to database
- `persistOrderItems()` - Save order items to database

### Step 6: Split Order Timeline Service
**File**: `services/order-tracking.service.ts` (new)
**Extract from**: `order-timeline.service.ts` (765 lines)
**Responsibilities**:
- Order tracking information
- Shipping status
- Delivery updates

**Keep in `order-timeline.service.ts`**:
- Timeline queries
- Status history
- Event timeline

### Step 7: Refactor Orders Service to Orchestrator
**File**: `orders.service.ts` (reduce to <300 lines)
**Responsibilities**:
- Delegate to specialized services
- Provide unified API
- Handle cross-cutting concerns
- No direct DB queries
- No complex business logic

## Dependencies Between Services

```
OrdersService (orchestrator)
├── OrderCreationService
│   ├── OrderInventoryService
│   ├── OrderDiscountService
│   ├── OrderValidationService (existing)
│   ├── OrderPricingService (existing)
│   └── OrderGstService (existing)
├── OrderQueryService
│   └── OrderEnrichmentService
├── OrderStatusService (existing)
└── OrderTimelineService (existing)
    └── OrderTrackingService (new)
```

## Execution Order
1. OrderInventoryService (simplest, least dependencies)
2. OrderDiscountService (depends on discount engine)
3. OrderEnrichmentService (depends on product enrichment)
4. OrderQueryService (depends on enrichment)
5. OrderCreationService (depends on inventory, discount)
6. Split OrderTimelineService
7. Refactor OrdersService to orchestrator
