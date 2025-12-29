# Order Error Handling Guide

## Overview

This guide documents error codes, error handling strategies, and recovery procedures for the orders module.

## Error Categories

### 1. Validation Errors (400 Bad Request)

**Common Causes**:
- Empty cart
- Invalid addresses
- Missing required fields
- Invalid discount codes

**Recovery**:
- Fix input data
- Retry request with corrected data

**Example**:
```json
{
  "statusCode": 400,
  "message": "Cart is empty",
  "error": "Bad Request"
}
```

### 2. Authentication Errors (401 Unauthorized)

**Common Causes**:
- Missing or invalid JWT token
- Expired session
- Invalid user credentials

**Recovery**:
- Re-authenticate
- Refresh token
- Check session validity

### 3. Not Found Errors (404)

**Common Causes**:
- Order doesn't exist
- Order doesn't belong to user
- Address not found

**Recovery**:
- Verify order ID
- Check user permissions
- Verify resource exists

### 4. Conflict Errors (409)

**Common Causes**:
- Cart already being checked out
- Order already exists (idempotency)
- Invalid checkout state

**Recovery**:
- Wait for current operation to complete
- Use existing order if idempotent
- Reset checkout state if needed

### 5. Inventory Commit Failures (CRITICAL)

**Error Code**: Logged as critical error, not thrown

**Common Causes**:
- Redis connection failure
- Lua script execution failure
- Network issues

**Recovery**:
1. Check order was created (may exist without inventory decrement)
2. Run manual reconciliation
3. Fix inventory using compensation transaction
4. See [Reconciliation Guide](./reconciliation.md)

**Detection**:
- Prometheus metric: `inventory_commit_failed_total`
- Logs with `critical: true` tag
- Daily reconciliation job

### 6. Payment Intent Creation Failures

**Common Causes**:
- Payment gateway timeout
- Invalid payment amount
- Gateway API errors

**Recovery**:
- Retry payment intent creation
- Verify payment amount calculation
- Check payment gateway status

**Metrics**: `payment_intent_created_failed_total`

### 7. Webhook Processing Failures

**Common Causes**:
- Invalid webhook signature
- Payment not confirmed
- Order already exists

**Recovery**:
- Verify webhook signature
- Check payment status
- Use reconciliation endpoint if needed

**Metrics**: `webhook_processing_duration_seconds` (high duration indicates issues)

## Error Response Format

All errors follow this structure:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Error Type"
}
```

## Error Codes Reference

| Status Code | Error Type | Common Scenarios |
|------------|-----------|-----------------|
| 400 | Bad Request | Validation errors, empty cart |
| 401 | Unauthorized | Missing/invalid auth token |
| 404 | Not Found | Order/address not found |
| 409 | Conflict | Idempotency, state conflicts |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected errors |

## Recovery Procedures

### Order Creation Failures

1. **Check Order Status**: Verify if order was created
2. **Check Inventory**: Verify inventory was decremented
3. **Reconcile**: Run reconciliation if mismatch detected
4. **Retry**: If order not created, retry checkout

### Payment Intent Failures

1. **Verify Amount**: Check payment amount calculation
2. **Check Gateway**: Verify payment gateway status
3. **Retry**: Use payment retry endpoint
4. **Contact Support**: If persistent failures

### Inventory Commit Failures

1. **CRITICAL**: Check if order exists
2. **Reconcile**: Run manual reconciliation
3. **Fix Inventory**: Use compensation transaction
4. **Monitor**: Check metrics and logs

## Monitoring

### Key Metrics

- `orders_created_total` - Success rate
- `orders_created_failed_total` - Failure rate
- `inventory_commit_failed_total` - CRITICAL failures
- `payment_intent_created_failed_total` - Payment failures
- `webhook_processing_duration_seconds` - Processing time

### Alerts

- Inventory commit failures (any failure is critical)
- High error rate (> 5% failures)
- Slow webhook processing (> 10 seconds)
- Payment intent creation failures

## Best Practices

1. **Idempotency**: Always use idempotent operations
2. **Error Logging**: Check logs for detailed error context
3. **Monitoring**: Monitor metrics proactively
4. **Recovery**: Follow recovery procedures promptly
5. **Documentation**: Document any manual interventions

## Related Documentation

- [Troubleshooting Guide](./troubleshooting.md)
- [Reconciliation Guide](./reconciliation.md)
- [Order Creation Flow](./creation.md)
