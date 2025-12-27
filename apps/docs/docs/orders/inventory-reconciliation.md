# Inventory Reconciliation

## Overview

Inventory reconciliation ensures that inventory levels remain accurate even when inventory commit operations fail during order creation. This document describes the reconciliation process and requirements.

## Problem Statement

### Inventory Commit Failures

During order creation in `finalizeOrderFromPayment`, inventory is decremented after payment confirmation. However, if the inventory decrement operation fails (caught in try-catch), the order is still created but inventory won't be decremented.

**Scenario:**
1. Payment webhook received
2. Order created successfully
3. Inventory decrement fails (Redis unavailable, network error, etc.)
4. Order exists but inventory wasn't decremented
5. **Result**: Inventory levels are incorrect

### Critical Error Logging

When inventory commit fails, the system logs a **CRITICAL** error:

```typescript
logger.error("CRITICAL: Failed to commit inventory for order", {
  orderId,
  variantItemsCount,
  bundleItemsCount,
  critical: true,
  error,
});
```

**Key Indicators:**
- Error log contains `critical: true`
- Error message includes "CRITICAL: Failed to commit inventory"
- Order exists but inventory wasn't decremented

## Manual Reconciliation Process

### Step 1: Identify Failed Commits

Query logs for critical inventory errors:

```bash
# Search logs for critical inventory errors
grep "CRITICAL: Failed to commit inventory" logs/app.log

# Or query structured logs
{
  "level": "error",
  "critical": true,
  "message": "CRITICAL: Failed to commit inventory"
}
```

### Step 2: Verify Order Existence

For each order ID found in critical errors:

```typescript
// Check if order exists
const order = await ordersService.findOne(orderId);

if (!order) {
  // Order doesn't exist - error was false positive
  return;
}

// Check order status
if (order.status === "cancelled" || order.status === "refunded") {
  // Order was cancelled - inventory should not be decremented
  return;
}
```

### Step 3: Check Current Inventory

Verify if inventory was actually decremented:

```typescript
// Get order items
const items = await db
  .select()
  .from(orderItems)
  .where(eq(orderItems.orderId, orderId));

// Check inventory for each item
for (const item of items) {
  const currentInventory = await inventoryStore.getAvailableInventory(
    item.productVariantId,
  );
  
  // Compare with expected inventory
  // If current inventory is higher than expected, reconciliation needed
}
```

### Step 4: Decrement Inventory Manually

If inventory wasn't decremented, manually decrement it:

```typescript
async reconcileInventoryForOrder(orderId: string): Promise<void> {
  const order = await ordersService.findOne(orderId);
  
  if (!order || order.status === "cancelled") {
    return; // Skip cancelled orders
  }
  
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  
  for (const item of items) {
    if (item.metadata?.type === "bundle" && item.metadata.selections) {
      // Handle bundle items
      const variantQuantities = flattenBundleSelections(
        item.metadata.selections,
        item.quantity,
      );
      
      for (const vq of variantQuantities) {
        await inventoryStore.incrementInventory(
          vq.variantId,
          -vq.quantity, // Negative to decrement
        );
      }
    } else {
      // Regular variant item
      await inventoryStore.incrementInventory(
        item.productVariantId,
        -item.quantity, // Negative to decrement
      );
    }
  }
  
  logger.info("Inventory reconciled for order", { orderId });
}
```

## Automated Reconciliation (Recommended)

### Background Job Design

Create a background job that periodically checks for orders with failed inventory commits:

```typescript
@Cron("0 */6 * * *") // Run every 6 hours
async reconcileInventory(): Promise<void> {
  // Find orders created in last 24 hours
  const recentOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        inArray(orders.status, ["pending", "confirmed", "processing", "shipped", "delivered"]),
      ),
    );
  
  for (const order of recentOrders) {
    // Check if inventory was decremented
    const needsReconciliation = await this.checkInventoryReconciliation(order.id);
    
    if (needsReconciliation) {
      await this.reconcileInventoryForOrder(order.id);
    }
  }
}
```

### Reconciliation Check

```typescript
async checkInventoryReconciliation(orderId: string): Promise<boolean> {
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  
  // Check if inventory matches expected levels
  // This requires tracking expected inventory levels per order
  // Or checking if inventory is higher than it should be
  
  // Simple heuristic: Check if inventory is suspiciously high
  // compared to order quantities
  for (const item of items) {
    const currentInventory = await inventoryStore.getAvailableInventory(
      item.productVariantId,
    );
    
    // If inventory seems too high, might need reconciliation
    // This is a simplified check - production should use more sophisticated logic
  }
  
  return false; // Return true if reconciliation needed
}
```

## Prevention Strategies

### 1. Retry Logic

Add retry logic for inventory commits:

```typescript
async commitInventoryWithRetry(
  orderId: string,
  items: CartItem[],
  maxRetries = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await this.commitInventory(orderId, items);
      return; // Success
    } catch (error) {
      if (attempt === maxRetries) {
        // Final attempt failed - log critical error
        logger.error("CRITICAL: Failed to commit inventory after retries", {
          orderId,
          attempts: maxRetries,
          error,
        });
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000),
      );
    }
  }
}
```

### 2. Transaction Wrapping

Consider wrapping order creation and inventory commit in a transaction:

```typescript
// Note: This requires careful design as order creation happens
// after payment confirmation, which is external
// May need two-phase commit or saga pattern
```

### 3. Inventory Commit Queue

Use a message queue for inventory commits:

```typescript
// After order creation, enqueue inventory commit
await inventoryCommitQueue.add({
  orderId,
  items,
  retries: 0,
});

// Background worker processes queue with retry logic
```

## Monitoring

### Metrics to Track

- **Inventory commit success rate**: Percentage of successful commits
- **Critical inventory errors**: Count of failed commits
- **Reconciliation operations**: Count of manual/automatic reconciliations
- **Inventory drift**: Difference between expected and actual inventory

### Alerts

Set up alerts for:
- High rate of critical inventory errors
- Orders created without inventory decrement
- Inventory levels inconsistent with orders

## Best Practices

1. **Monitor Critical Errors**: Regularly check logs for critical inventory errors
2. **Automate Reconciliation**: Implement background job for automatic reconciliation
3. **Retry Logic**: Add retry logic for transient failures
4. **Alerting**: Set up alerts for inventory inconsistencies
5. **Documentation**: Document reconciliation process for operations team

## Future Improvements

1. **Two-Phase Commit**: Implement two-phase commit for order creation and inventory
2. **Saga Pattern**: Use saga pattern for distributed transactions
3. **Inventory Audit Trail**: Track all inventory changes with order references
4. **Real-time Reconciliation**: Real-time checks instead of periodic jobs
5. **Admin UI**: Build admin UI for manual reconciliation

