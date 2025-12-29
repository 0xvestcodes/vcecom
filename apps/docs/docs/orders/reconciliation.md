# Order Inventory Reconciliation

## Overview

Inventory reconciliation is a critical process to ensure data consistency between orders and inventory levels. This document describes both automated and manual reconciliation procedures.

## Automated Reconciliation

### Daily Reconciliation Job

A scheduled job runs daily at 2 AM to detect potential inventory mismatches:

- **Location**: `apps/backend/src/modules/orders/jobs/inventory-reconciliation.job.ts`
- **Schedule**: Daily at 2 AM (configurable via `@Cron` decorator)
- **Process**: 
  - Scans orders from the last 24 hours
  - Checks inventory levels for each order's variants
  - Flags potential mismatches for manual review

### Monitoring

Reconciliation results are logged with:
- Number of mismatches found
- Order IDs and issues detected
- Errors encountered during reconciliation

## Manual Reconciliation

### When Manual Reconciliation is Needed

Manual reconciliation is required when:
1. Inventory commit fails during order creation (CRITICAL)
2. Automated reconciliation detects mismatches
3. Inventory levels don't match expected values
4. Orders exist but inventory wasn't decremented

### Reconciliation Process

#### Step 1: Identify Mismatched Orders

Query orders where inventory commit may have failed:

```sql
-- Find orders from last 24 hours
SELECT id, order_number, status, created_at
FROM orders
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

#### Step 2: Check Inventory Levels

For each order, verify inventory was decremented:

```typescript
// Using Redis CLI or application
GET inventory:variant:{variantId}
```

Compare against expected inventory (should be decremented by order quantity).

#### Step 3: Fix Inventory Mismatches

**Option A: Compensation Transaction (Recommended)**

If order was created but inventory wasn't decremented:
1. Decrement inventory manually using the atomic Lua script
2. Log the compensation transaction
3. Update order status if needed

**Option B: Rollback Order**

If order creation failed but inventory was decremented:
1. Increment inventory back
2. Cancel/delete the order
3. Notify customer if needed

### Compensation Strategy

**Decision**: Use compensation transactions (Option A) rather than rollbacks.

**Rationale**:
- Orders represent customer commitments - rolling back is disruptive
- Compensation transactions maintain order integrity
- Easier to audit and track corrections
- Less risk of data inconsistency

### Manual Reconciliation Endpoint

For admin use, a reconciliation endpoint is available:

```typescript
// POST /admin/orders/reconcile/{orderId}
// Manually trigger reconciliation for a specific order
```

## Inventory Commit Failure Handling

### Detection

Inventory commit failures are detected through:
1. **Metrics**: `inventory_commit_failed_total` counter in Prometheus
2. **Logs**: Critical error logs with `critical: true` tag
3. **Reconciliation Job**: Daily automated checks

### Response Procedure

1. **Immediate**: 
   - Check Prometheus metrics for failure count
   - Review critical error logs
   - Identify affected orders

2. **Short-term**:
   - Run manual reconciliation for affected orders
   - Fix inventory mismatches using compensation transactions
   - Verify fixes

3. **Long-term**:
   - Investigate root cause (Redis connectivity, Lua script errors, etc.)
   - Implement preventive measures
   - Update monitoring/alerting thresholds

## Monitoring & Alerting

### Critical Alerts

Set up alerts for:
- `inventory_commit_failed_total > 0` (any failure is critical)
- Reconciliation job failures
- High mismatch rate (> 1% of orders)

### Dashboards

Monitor:
- Inventory commit failure rate
- Reconciliation job execution status
- Mismatch detection trends
- Compensation transaction counts

## Best Practices

1. **Regular Monitoring**: Check metrics daily
2. **Quick Response**: Address mismatches within 24 hours
3. **Documentation**: Log all manual reconciliation actions
4. **Root Cause Analysis**: Investigate patterns in failures
5. **Prevention**: Address underlying issues causing failures

## Troubleshooting

### Common Issues

**Issue**: Reconciliation job not running
- **Check**: Cron schedule configuration
- **Verify**: Job is registered in OrdersModule

**Issue**: High mismatch rate
- **Check**: Redis connectivity and performance
- **Verify**: Lua script execution success rate
- **Review**: Order creation flow for errors

**Issue**: Inventory levels incorrect
- **Check**: Manual inventory adjustments
- **Verify**: No concurrent modifications
- **Review**: Order cancellation/refund processes

## Related Documentation

- [Order Creation Flow](./creation.md)
- [Inventory Management](../catalog/inventory.md)
- [Monitoring & Observability](../observability/)
