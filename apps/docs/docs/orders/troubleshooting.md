# Order Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: Order Created But Inventory Not Decremented

**Symptoms**:
- Order exists in database
- Inventory levels unchanged
- Critical error logs present

**Diagnosis**:
1. Check Prometheus metric: `inventory_commit_failed_total`
2. Review logs for `CRITICAL: Failed to commit inventory`
3. Verify order creation timestamp

**Solution**:
1. Run manual reconciliation (see [Reconciliation Guide](./reconciliation.md))
2. Fix inventory using compensation transaction
3. Investigate root cause (Redis connectivity, Lua script errors)

**Prevention**:
- Monitor Redis health
- Set up alerts for inventory commit failures
- Regular reconciliation job execution

### Issue 2: Payment Intent Creation Fails

**Symptoms**:
- 409 Conflict error
- Payment intent not created
- Checkout stuck

**Diagnosis**:
1. Check payment gateway status
2. Verify payment amount calculation
3. Review payment intent creation logs

**Solution**:
1. Verify payment amount includes fees
2. Check payment gateway API status
3. Retry payment intent creation
4. Use payment retry endpoint if order exists

**Prevention**:
- Validate payment amounts before creation
- Monitor payment gateway health
- Implement retry logic with backoff

### Issue 3: Webhook Processing Timeout

**Symptoms**:
- Webhook received but order not created
- High `webhook_processing_duration_seconds` metric
- Timeout errors in logs

**Diagnosis**:
1. Check webhook processing duration metric
2. Review order creation flow logs
3. Verify database/Redis performance

**Solution**:
1. Check if order was created (idempotency)
2. Use reconciliation endpoint if needed
3. Optimize slow operations
4. Scale resources if needed

**Prevention**:
- Monitor processing times
- Optimize database queries
- Use connection pooling
- Implement timeout handling

### Issue 4: Duplicate Orders

**Symptoms**:
- Multiple orders for same payment intent
- Customer reports duplicate charges

**Diagnosis**:
1. Check idempotency mappings
2. Review payment intent to order mappings
3. Check concurrent creation logs

**Solution**:
1. Verify idempotency is working
2. Check for race conditions
3. Merge/delete duplicate orders if needed
4. Process refunds if duplicate charges occurred

**Prevention**:
- Ensure idempotency checks are atomic
- Use payment-scoped idempotency
- Monitor for concurrent creation patterns

### Issue 5: Order Cancellation Refund Not Created

**Symptoms**:
- Order cancelled but refund not processed
- Payment captured but no refund record

**Diagnosis**:
1. Check order cancellation logs
2. Verify payment status
3. Check refund creation logs

**Solution**:
1. Manually create refund if needed
2. Verify refund service is working
3. Process refund via payment gateway
4. Update order status

**Prevention**:
- Monitor refund creation success rate
- Set up alerts for refund failures
- Test cancellation flow regularly

## Debugging Procedures

### Step 1: Check Logs

```bash
# Search for critical errors
grep "CRITICAL" logs/orders.log

# Check for specific order
grep "orderId=xxx" logs/orders.log

# Review recent errors
tail -n 100 logs/orders.log | grep ERROR
```

### Step 2: Check Metrics

```bash
# Query Prometheus for inventory failures
curl http://localhost:3000/metrics | grep inventory_commit_failed_total

# Check order creation rate
curl http://localhost:3000/metrics | grep orders_created_total
```

### Step 3: Verify Database State

```sql
-- Check order exists
SELECT * FROM orders WHERE id = 'order-id';

-- Check order items
SELECT * FROM order_items WHERE order_id = 'order-id';

-- Check payment
SELECT * FROM payments WHERE order_id = 'order-id';
```

### Step 4: Check Redis State

```bash
# Check inventory levels
redis-cli GET inventory:variant:{variantId}

# Check checkout session
redis-cli GET checkout:session:{sessionId}

# Check payment intent
redis-cli GET payment:intent:{sessionId}
```

## Log Analysis

### Key Log Patterns

**Inventory Commit Failure**:
```
CRITICAL: Failed to commit inventory for order - manual reconciliation required
```

**Payment Intent Failure**:
```
Payment intent creation returned invalid result
```

**Webhook Processing Error**:
```
Failed to create order
```

**Idempotency Conflict**:
```
Order already exists for payment intent
```

### Log Context Fields

- `orderId` - Order identifier
- `cartId` - Cart identifier
- `checkoutSessionId` - Checkout session
- `paymentIntentId` - Payment intent
- `critical: true` - Critical errors requiring attention

## Performance Issues

### Slow Order Creation

**Symptoms**:
- High `order_finalization_duration_seconds`
- Timeout errors
- Customer complaints

**Diagnosis**:
1. Check database query performance
2. Verify Redis latency
3. Review external API calls (payment gateway)

**Solution**:
1. Optimize database queries
2. Add database indexes
3. Use connection pooling
4. Cache frequently accessed data
5. Optimize Redis operations

### High Error Rate

**Symptoms**:
- `orders_created_failed_total` increasing
- Multiple error types occurring

**Diagnosis**:
1. Check error distribution
2. Identify common error patterns
3. Review system health (DB, Redis, APIs)

**Solution**:
1. Address root causes
2. Implement retry logic
3. Add circuit breakers
4. Scale resources
5. Fix underlying issues

## Monitoring Checklist

- [ ] Inventory commit failure rate
- [ ] Order creation success rate
- [ ] Payment intent creation success rate
- [ ] Webhook processing time
- [ ] Database connection pool usage
- [ ] Redis memory usage
- [ ] Error rate trends
- [ ] Reconciliation job execution

## Escalation Procedures

### Level 1: Automated Recovery
- Retry failed operations
- Use reconciliation endpoints
- Check idempotency

### Level 2: Manual Intervention
- Run manual reconciliation
- Fix inventory mismatches
- Process refunds manually

### Level 3: Engineering Support
- Investigate root causes
- Fix underlying issues
- Update monitoring/alerting

## Related Documentation

- [Error Handling Guide](./error-handling.md)
- [Reconciliation Guide](./reconciliation.md)
- [Order Creation Flow](./creation.md)
- [Monitoring & Observability](../observability/)
