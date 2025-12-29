# Deployment Checklist

## Pre-Deployment

### Database Migrations
- [ ] All migrations tested in staging
- [ ] Migration rollback procedures documented
- [ ] Database backup created before migration
- [ ] Migration execution time estimated
- [ ] Verify migration doesn't lock tables for extended periods

### Redis Configuration
- [ ] Redis connection string verified
- [ ] Redis memory limits configured
- [ ] Redis persistence enabled (if required)
- [ ] Redis connection pool size configured
- [ ] Redis health checks configured

### Payment Gateway Webhook URL
- [ ] Webhook URL configured in payment gateway dashboard
- [ ] Webhook signature verification enabled
- [ ] Webhook endpoint tested
- [ ] Webhook retry configuration verified
- [ ] Webhook timeout settings configured

### Environment Variables
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `REDIS_URL` - Redis connection string
- [ ] `RAZORPAY_KEY_ID` - Payment gateway key
- [ ] `RAZORPAY_KEY_SECRET` - Payment gateway secret
- [ ] `WEBHOOK_SECRET` - Webhook signature secret
- [ ] `NODE_ENV` - Environment (production/staging)
- [ ] `LOG_LEVEL` - Logging level
- [ ] All environment variables documented

### Monitoring & Alerting
- [ ] Prometheus metrics endpoint configured (`/metrics`)
- [ ] Alert rules configured in Prometheus
- [ ] Alertmanager configured for notifications
- [ ] Grafana dashboards imported
- [ ] Critical alerts tested (inventory commit failures)
- [ ] Alert notification channels configured (email, Slack, PagerDuty)

### Application Configuration
- [ ] Rate limiting configured
- [ ] CORS settings configured
- [ ] API documentation accessible
- [ ] Health check endpoints configured
- [ ] Logging configuration verified

## Deployment Steps

### 1. Database Migration
```bash
# Run migrations
npm run migrate:up

# Verify migration success
npm run migrate:status
```

### 2. Application Deployment
```bash
# Build application
npm run build

# Start application
npm run start:prod
```

### 3. Health Checks
```bash
# Check database health
curl http://localhost:3000/_health/database

# Check Redis health
curl http://localhost:3000/_health/redis

# Check application health
curl http://localhost:3000/_health
```

### 4. Metrics Verification
```bash
# Verify metrics endpoint
curl http://localhost:3000/metrics | grep orders_created_total

# Verify Prometheus can scrape metrics
curl http://localhost:3000/metrics
```

### 5. Smoke Tests
- [ ] Create test order (payment intent)
- [ ] Verify webhook processing
- [ ] Check order creation
- [ ] Verify inventory decrement
- [ ] Test order cancellation
- [ ] Verify refund processing

## Post-Deployment

### Verification
- [ ] Application logs show no errors
- [ ] Metrics are being collected
- [ ] Alerts are firing correctly
- [ ] Order creation flow works
- [ ] Payment processing works
- [ ] Inventory reconciliation job runs

### Monitoring
- [ ] Monitor error rates for first hour
- [ ] Check inventory commit failure rate
- [ ] Verify webhook processing times
- [ ] Monitor database connection pool
- [ ] Check Redis memory usage

### Rollback Plan
- [ ] Database migration rollback script ready
- [ ] Previous application version tagged
- [ ] Rollback procedure documented
- [ ] Rollback tested in staging

## Backup & Recovery

### Database Backups
- [ ] Automated daily backups configured
- [ ] Backup retention policy set
- [ ] Backup restoration tested
- [ ] Point-in-time recovery available

### Redis Backups
- [ ] Redis persistence configured
- [ ] Redis backup strategy defined
- [ ] Redis recovery procedure documented

### Application State
- [ ] Checkout sessions backed up (Redis)
- [ ] Payment intent mappings backed up
- [ ] Order data in database (primary backup)

## Security Checklist

- [ ] API authentication enabled
- [ ] Rate limiting enabled
- [ ] Input validation enabled
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified
- [ ] HTTPS enabled
- [ ] Secrets management configured
- [ ] Audit logging enabled

## Performance Checklist

- [ ] Database indexes created
- [ ] Connection pooling configured
- [ ] Query performance optimized
- [ ] Redis caching configured
- [ ] Rate limiting configured appropriately
- [ ] Load balancing configured (if applicable)

## Documentation

- [ ] API documentation updated
- [ ] Deployment procedures documented
- [ ] Runbook created
- [ ] Troubleshooting guide available
- [ ] Error handling guide available

## Related Documentation

- [Runbook](./RUNBOOK.md)
- [Error Handling Guide](../docs/docs/orders/error-handling.md)
- [Troubleshooting Guide](../docs/docs/orders/troubleshooting.md)
- [Reconciliation Guide](../docs/docs/orders/reconciliation.md)
