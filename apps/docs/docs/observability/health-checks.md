# Health Checks

The system provides comprehensive health check endpoints to monitor the status of critical services and components. All health endpoints are publicly accessible (no authentication required) and follow a consistent response format.

## Overview

Health checks are available at the `/_health/*` endpoints and provide real-time status information about:

- Database connectivity and connection pool status
- Redis connection and memory usage
- Background job execution status
- Logging system status
- Tracing system status

## Available Health Endpoints

### Database Health

**Endpoint**: `GET /_health/database`

**Description**: Returns database connection pool status and connectivity test.

**Response**:
```json
{
  "status": "OK",
  "pool": {
    "healthy": true,
    "stats": {
      "totalConnections": 20,
      "usedConnections": 5,
      "idleConnections": 15,
      "waitingConnections": 0,
      "usagePercent": 25,
      "maxConnections": 20
    }
  },
  "connectivity": {
    "status": "OK",
    "queryLatency": "2ms"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Status Values**: `OK`, `ERROR`

**Use Cases**:
- Verify database connectivity
- Monitor connection pool usage
- Detect database performance issues

---

### Redis Health

**Endpoint**: `GET /_health/redis`

**Description**: Returns Redis connection status, memory usage, client counts, and keyspace statistics.

**Response**:
```json
{
  "status": "healthy",
  "connection": {
    "status": "connected",
    "latency": 1
  },
  "memory": {
    "used": 52428800,
    "peak": 67108864,
    "total": 1073741824,
    "percentage": 4.88
  },
  "clients": {
    "connected": 5,
    "blocked": 0
  },
  "keyspace": {
    "totalKeys": 15234,
    "byPattern": {
      "inventory:*": 1234,
      "cart:*": 567,
      "checkout:*": 89
    }
  },
  "replication": {
    "role": "master",
    "connectedSlaves": 2
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Status Values**: `healthy`, `unhealthy`, `degraded`

**Use Cases**:
- Monitor Redis memory usage
- Check connection latency
- Track keyspace patterns
- Verify replication status

---

### Jobs Health

**Endpoint**: `GET /_health/jobs`

**Description**: Returns status of all background jobs including last execution time, success/failure counts, and overall health.

**Response**:
```json
{
  "status": "OK",
  "totalJobs": 4,
  "healthyJobs": 4,
  "unhealthyJobs": 0,
  "jobs": [
    {
      "name": "inventory-reconciliation",
      "description": "Periodic inventory reconciliation (every 7 minutes)",
      "schedule": "*/7 * * * *",
      "status": "idle",
      "lastRun": "2024-01-15T10:28:00Z",
      "lastDuration": 1250,
      "lastError": null,
      "executionCount": 1234,
      "successCount": 1230,
      "failureCount": 4,
      "health": "OK"
    },
    {
      "name": "media-consistency-maintenance",
      "description": "Nightly media consistency maintenance (daily at 3 AM)",
      "schedule": "0 3 * * *",
      "status": "idle",
      "lastRun": "2024-01-15T03:00:00Z",
      "lastDuration": 5432,
      "lastError": null,
      "executionCount": 365,
      "successCount": 365,
      "failureCount": 0,
      "health": "OK"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Status Values**: `OK`, `DEGRADED`, `ERROR`

**Job Health Determination**:
- **ERROR**: Last execution failed
- **DEGRADED**: Currently running but exceeded 30-minute threshold
- **OK**: Job is healthy

**Overall Status**:
- **OK**: All jobs healthy
- **DEGRADED**: Some jobs unhealthy
- **ERROR**: All jobs unhealthy

**Use Cases**:
- Monitor background job execution
- Detect failed job executions
- Track job performance metrics

---

### Logging Health

**Endpoint**: `GET /_health/logging`

**Description**: Returns logging system status including Pino logger and context service.

**Response**:
```json
{
  "status": "OK",
  "logger": {
    "status": "OK",
    "level": "info",
    "service": "vcecom-backend"
  },
  "contextService": {
    "status": "OK"
  },
  "redaction": {
    "enabled": true,
    "paths": [
      "customer.email",
      "customer.phone",
      "payment.card_last4",
      "headers.authorization"
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Status Values**: `OK`, `ERROR`

---

### Tracing Health

**Endpoint**: `GET /_health/tracing`

**Description**: Returns OpenTelemetry tracing system status.

**Response**:
```json
{
  "status": "OK",
  "enabled": true,
  "tracerProvider": {
    "status": "OK"
  },
  "exporter": {
    "type": "zipkin",
    "endpoint": "http://localhost:9411/api/v2/spans"
  },
  "sampling": {
    "rate": 1,
    "percentage": "100%"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Status Values**: `OK`, `ERROR`

---

## Usage Examples

### Docker Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/_health/database', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

### Kubernetes Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /_health/database
    port: 3001
  initialDelaySeconds: 40
  periodSeconds: 30
  timeoutSeconds: 3
  failureThreshold: 3
```

### Kubernetes Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /_health/redis
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 3
```

### Monitoring Script

```bash
#!/bin/bash
ENDPOINTS=(
  "/_health/database"
  "/_health/redis"
  "/_health/jobs"
  "/_health/logging"
  "/_health/tracing"
)

for endpoint in "${ENDPOINTS[@]}"; do
  response=$(curl -s "http://localhost:3001${endpoint}")
  status=$(echo $response | jq -r '.status')
  echo "${endpoint}: ${status}"
  
  if [ "$status" != "OK" ] && [ "$status" != "healthy" ]; then
    echo "ALERT: ${endpoint} is unhealthy!"
    exit 1
  fi
done
```

## Monitoring Integration

### Prometheus Metrics

Health checks can be scraped by Prometheus to track service health over time:

```yaml
scrape_configs:
  - job_name: 'vcecom-health'
    metrics_path: '/_health/database'
    static_configs:
      - targets: ['backend:3001']
```

### Alerting Rules

Set up alerts based on health check failures:

```yaml
groups:
  - name: health_checks
    interval: 30s
    rules:
      - alert: DatabaseUnhealthy
        expr: health_check{endpoint="database", status!="OK"} == 1
        for: 2m
        annotations:
          summary: "Database health check failing"
      
      - alert: RedisUnhealthy
        expr: health_check{endpoint="redis", status!="healthy"} == 1
        for: 2m
        annotations:
          summary: "Redis health check failing"
      
      - alert: JobsUnhealthy
        expr: health_check{endpoint="jobs", status!="OK"} == 1
        for: 5m
        annotations:
          summary: "Background jobs health check failing"
```

## Best Practices

1. **Regular Monitoring**: Check health endpoints every 30-60 seconds
2. **Multiple Checks**: Don't rely on a single health endpoint - check multiple
3. **Graceful Degradation**: Handle degraded status appropriately
4. **Alert Thresholds**: Set appropriate thresholds before alerting
5. **Log Health Status**: Log health check results for trend analysis

## Troubleshooting

### Database Health Check Failing

1. Check database connection pool configuration
2. Verify database server is accessible
3. Check for connection leaks
4. Review database logs

### Redis Health Check Failing

1. Verify Redis server is running
2. Check memory limits
3. Review Redis logs
4. Check network connectivity

### Jobs Health Check Failing

1. Review job execution logs
2. Check job schedules
3. Verify Redis connectivity (jobs depend on Redis)
4. Check for long-running jobs

