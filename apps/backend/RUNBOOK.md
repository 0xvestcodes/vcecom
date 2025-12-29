# Operational Runbook

## Common Issues and Procedures

### Issue: Inventory Commit Failure

**Symptoms**:
- Order created but inventory not decremented
- `inventory_commit_failed_total` metric > 0
- Critical error logs present

**Procedure**:
1. Check Prometheus metrics: `inventory_commit_failed_total`
2. Identify affected orders from logs
3. Run manual reconciliation (see Reconciliation Guide)
4. Fix inventory using compensation transaction
5. Verify fix and monitor

**Prevention**:
- Monitor Redis health
- Set up alerts for failures
- Regular reconciliation job execution

### Issue: Payment Intent Creation Fails

**Symptoms**:
- 409 Conflict errors
- Payment intent not created
- Checkout stuck

**Procedure**:
1. Check payment gateway status
2. Verify payment amount calculation
3. Check payment gateway API logs
4. Retry payment intent creation
5. Use payment retry endpoint if order exists

**Prevention**:
- Validate payment amounts
- Monitor payment gateway health
- Implement retry logic

### Issue: Webhook Processing Timeout

**Symptoms**:
- Webhook received but order not created
- High processing duration metrics
- Timeout errors

**Procedure**:
1. Check if order was created (idempotency)
2. Use reconciliation endpoint if needed
3. Check database/Redis performance
4. Scale resources if needed
5. Optimize slow operations

**Prevention**:
- Monitor processing times
- Optimize database queries
- Use connection pooling

### Issue: High Error Rate

**Symptoms**:
- `orders_created_failed_total` increasing
- Multiple error types

**Procedure**:
1. Check error distribution
2. Identify common patterns
3. Review system health (DB, Redis, APIs)
4. Address root causes
5. Implement fixes

**Prevention**:
- Proactive monitoring
- Regular health checks
- Capacity planning

## Emergency Procedures

### Database Connection Issues

1. Check database health endpoint
2. Verify connection pool status
3. Check database server status
4. Review connection pool configuration
5. Restart application if needed

### Redis Connection Issues

1. Check Redis health endpoint
2. Verify Redis server status
3. Check Redis memory usage
4. Review Redis configuration
5. Restart Redis if needed

### Payment Gateway Outage

1. Check payment gateway status page
2. Monitor payment intent creation failures
3. Inform customers of delays
4. Implement graceful degradation
5. Process payments when gateway recovers

## Monitoring Procedures

### Daily Checks

1. Review error rates
2. Check inventory commit failures
3. Verify reconciliation job execution
4. Review payment processing metrics
5. Check system health

### Weekly Reviews

1. Analyze error trends
2. Review performance metrics
3. Check capacity utilization
4. Review alert effectiveness
5. Update documentation

## Escalation

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

## Contact Information

- **On-Call Engineer**: [Contact Info]
- **Database Team**: [Contact Info]
- **Payment Gateway Support**: [Contact Info]
- **Infrastructure Team**: [Contact Info]

## Related Documentation

- [Deployment Checklist](./DEPLOYMENT.md)
- [Error Handling Guide](../docs/docs/orders/error-handling.md)
- [Troubleshooting Guide](../docs/docs/orders/troubleshooting.md)
- [Reconciliation Guide](../docs/docs/orders/reconciliation.md)
