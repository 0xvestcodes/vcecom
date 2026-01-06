# Multi-Tenant / SaaS Infrastructure Assessment

**Date:** 2025-01-28  
**Status:** Current State Assessment  
**Conclusion:** Multi-Store (Single-Tenant), NOT Multi-Tenant

---

## Executive Summary

The codebase currently implements **multi-store support** within a **single-tenant architecture**, not true multi-tenancy. While the system supports multiple stores in the database, there is no tenant isolation, tenant-specific configurations, tenant-level metrics, or tenant-scoped admin roles.

**Key Finding:** The architecture is designed for a single deployment with multiple stores, not a SaaS platform where each tenant has isolated data and resources.

---

## 1. Tenant Isolation: ❌ NOT IMPLEMENTED

### Database Schema Analysis

**Core tables lacking `storeId` fields:**
- `products` - No `storeId` field
- `orders` - No `storeId` field  
- `customers` - No `storeId` field
- `categories` - No `storeId` field
- `collections` - No `storeId` field
- `discounts` - No `storeId` field
- `order_items` - No `storeId` field
- `payments` - No `storeId` field
- `shipments` - No `storeId` field
- `addresses` - No `storeId` field
- `carts` - No `storeId` field (stored in Redis)

**Tables with `storeId` (partial implementation):**
- `webhooks` - Has `storeId` (references `stores.id`)
- `themes` - Has `storeId`
- `theme_settings` - Has `storeId`
- `blog_posts` - Has `storeId`
- `incoming_webhooks` - Has `storeId`

### Code Evidence

**Explicit single-tenant assumption:**

```244:245:apps/backend/src/modules/webhooks/services/webhook-delivery.service.ts
// For now, get the default store (single-tenant assumption)
// TODO: Update when multi-tenant storeId fields are added to orders/products/customers
```

**Services use `getDefaultStoreId()` pattern:**

All services that need a store ID use a helper method that always returns the default or first store:

- `apps/backend/src/modules/products/products.service.ts:171-185`
- `apps/backend/src/modules/customers/customers.service.ts:275`
- `apps/backend/src/modules/webhooks/admin-webhooks.controller.ts:53`
- `apps/backend/src/modules/blog/blog-posts.service.ts:38`

**Example implementation:**

```171:185:apps/backend/src/modules/products/products.service.ts
private async getDefaultStoreId(): Promise<string> {
  const [defaultStore] = await this.db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.isDefault, true))
    .limit(1);

  if (defaultStore) {
    return defaultStore.id;
  }

  const [firstStore] = await this.db.select({ id: stores.id }).from(stores).limit(1);
  if (firstStore) {
    return firstStore.id;
  }
```

### Row-Level Security

**Status:** No PostgreSQL Row-Level Security (RLS) policies found.

**Impact:** No database-level tenant isolation. All data is accessible to any authenticated user with proper permissions, regardless of store association.

---

## 2. Tenant Configs: ⚠️ PARTIAL (Single-Tenant Pattern)

### Current Implementation

**Stores table exists** with basic configuration:
- `name` - Store name
- `domain` - Store domain
- `currency` - Store currency (default: INR)
- `primaryColor` - Primary brand color
- `logoUrl` - Logo image URL
- `isDefault` - Flag for default store

**Location:** `packages/db/src/schema/stores.ts`

**Configuration Source of Truth:**

The `StoresService.getStore()` method uses **ENV vars as source of truth**, overriding database values:

```22:84:apps/backend/src/modules/stores/stores.service.ts
async getStore(): Promise<StoreResponseDto> {
  try {
    // Use ENV vars as source of truth
    const storeName =
      process.env.NEXT_PUBLIC_STORE_NAME ||
      process.env.STORE_NAME ||
      "Default Store";
    const storeDomain =
      process.env.NEXT_PUBLIC_STORE_DOMAIN ||
      process.env.STORE_DOMAIN ||
      "localhost";
    // ... more ENV vars ...
    
    // Return store with ENV vars overriding database values
    // This ensures ENV vars are always the source of truth
    return {
      ...this.mapToResponseDto(store),
      name: storeName,
      domain: storeDomain,
      currency: storeCurrency,
      primaryColor: storePrimaryColor,
      logoUrl: storeLogoUrl,
    };
  }
}
```

**This pattern indicates single-tenant behavior:** One configuration per deployment, not per tenant.

### Missing Tenant-Specific Configurations

- ❌ Per-tenant environment isolation
- ❌ Tenant-specific feature flags
- ❌ Tenant-specific payment gateway configs (Razorpay, Cashfree, PayU)
- ❌ Tenant-specific storage buckets
- ❌ Tenant-specific rate limits
- ❌ Tenant-specific email/SMS provider configs
- ❌ Tenant-specific shipping provider configs
- ❌ Tenant-specific search engine configs (Meilisearch, Elasticsearch)

---

## 3. Tenant-Level Metrics: ❌ NOT IMPLEMENTED

### Current Metrics Implementation

**Location:** `apps/backend/src/common/metrics/metrics.service.ts`

**Metrics tracked:**
- Order creation metrics (`orders_created_total`)
- Payment intent metrics (`payment_intent_created_total`)
- Inventory commit failures (`inventory_commit_failed_total`)
- Webhook processing duration (`webhook_processing_duration_seconds`)
- Order finalization duration (`order_finalization_duration_seconds`)

**Current labels:**
- `payment_method`
- `status`
- `error_type`
- `provider`
- `event_type`

**Missing:** No `store` or `tenant` labels on any metrics.

### Impact

- Cannot track metrics per tenant/store
- Cannot generate tenant-level dashboards
- Cannot monitor tenant resource usage
- Cannot implement tenant billing based on usage
- Cannot identify tenant-specific performance issues

---

## 4. Global Admin Superuser Role: ✅ EXISTS (But Not Tenant-Aware)

### Current Implementation

**Admin role exists:**
- Defined in `packages/db/src/schema/users.ts:11-17`
- Role enum: `["admin", "customer", "support", "reviewer", "marketing"]`

**Legacy admin role grants all permissions globally:**

```264:267:apps/backend/src/modules/permissions/permissions.service.ts
// Legacy admin role has all permissions
if (user.role === "admin") {
  return true;
}
```

**Same pattern in guards:**

```85:88:apps/backend/src/common/guards/permissions.guard.ts
// If user has "admin" role (legacy), grant all permissions
if (user.role === "admin") {
  return true;
}
```

### Issue

The admin role is **global**, not tenant-scoped. If multi-tenancy existed, a global admin would have access to all tenants, which is a security concern for SaaS platforms.

### Missing Tenant-Aware Admin Features

- ❌ Tenant-scoped admin roles
- ❌ Platform super-admin role (distinct from tenant admins)
- ❌ Tenant-level permission isolation
- ❌ Tenant switching capability for admins
- ❌ Tenant context in admin sessions

---

## Roadmap Evidence

The `ROADMAP.md` file explicitly lists multi-tenancy as **future work**:

```markdown
### SaaS Infrastructure (High Priority)
#### Multi-Tenancy
- Complete multi-tenant architecture
- Tenant isolation and security
- Resource quotas and limits
- Tenant-specific configurations
```

**Location:** `ROADMAP.md:167-192`

---

## Current Architecture Summary

**Architecture Type:** Single-tenant with multi-store support

**What works:**
- Multiple stores can exist in the database
- Store-specific themes and webhooks
- Store-specific blog posts

**What doesn't work (multi-tenant requirements):**
- ❌ Data isolation between stores
- ❌ Tenant-specific configurations
- ❌ Tenant-level metrics and monitoring
- ❌ Tenant-scoped admin roles
- ❌ Tenant resource quotas
- ❌ Tenant-aware request routing

**Shared resources:**
- Database schema (no isolation)
- Configuration (ENV vars)
- Metrics (no tenant labels)
- Admin users (global access)
- Redis keys (no tenant prefix in most cases)
- Storage buckets (shared)

---

## What Would Be Needed for True Multi-Tenancy

### 1. Database Schema Changes

**Required:**
- Add `storeId`/`tenantId` to all core tables:
  - `products`, `orders`, `customers`, `categories`, `collections`, `discounts`, `order_items`, `payments`, `shipments`, `addresses`
- Add foreign key constraints to `stores` table
- Create database indexes on `storeId` columns
- Implement database migrations for existing data

**Isolation options:**
- **Option A:** Application-level filtering (add `WHERE storeId = ?` to all queries)
- **Option B:** PostgreSQL Row-Level Security (RLS) policies
- **Option C:** Separate databases per tenant (not recommended for this scale)

**Recommended:** Option A (application-level) with Option B (RLS) as defense-in-depth.

### 2. Configuration Management

**Required:**
- Per-tenant configuration storage (database table or separate config service)
- Tenant-specific environment variables (or config override system)
- Tenant feature flags system
- Tenant-specific payment gateway configs
- Tenant-specific storage bucket isolation
- Tenant-specific rate limits

**Implementation approach:**
- Create `tenant_configs` table
- Implement `TenantConfigService` to fetch tenant-specific configs
- Add tenant context to all service methods
- Override global configs with tenant configs when available

### 3. Metrics & Observability

**Required:**
- Add `tenant_id` label to all Prometheus metrics
- Tenant-scoped metric queries
- Per-tenant resource usage tracking
- Tenant-level dashboards
- Tenant billing metrics

**Implementation:**
- Update all metric definitions in `apps/backend/src/common/metrics/metrics.service.ts`
- Add tenant context to metric recording
- Create tenant-scoped Grafana dashboards
- Implement tenant usage tracking service

### 4. Admin Roles & Permissions

**Required:**
- Tenant-scoped admin roles
- Platform super-admin role (distinct from tenant admins)
- Tenant-level permission isolation
- Tenant switching capability
- Tenant context in admin sessions

**Implementation:**
- Extend `admin_roles` table with `tenant_id` field
- Create `platform_admins` table for super-admins
- Update permission checks to include tenant context
- Add tenant selector to admin UI
- Update admin session to include tenant context

### 5. Infrastructure & Middleware

**Required:**
- Tenant-aware request routing
- Tenant context propagation (via headers, subdomain, or path)
- Tenant-specific rate limiting
- Tenant resource quotas
- Tenant-aware Redis key prefixes
- Tenant-aware storage bucket isolation

**Implementation:**
- Create `TenantContextMiddleware` to extract tenant from request
- Add tenant context to request object
- Implement tenant-aware rate limiting
- Add tenant prefix to Redis keys (where missing)
- Implement tenant resource quota service

### 6. API Changes

**Required:**
- Add tenant context to all API endpoints
- Update all service methods to accept tenant context
- Add tenant validation middleware
- Update API documentation

**Breaking changes:**
- All API endpoints would need tenant identification
- Service method signatures would change
- Database queries would need tenant filtering

---

## Migration Path Considerations

### Data Migration

If migrating existing single-tenant data to multi-tenant:

1. **Assign existing data to default tenant:**
   - All existing products, orders, customers → default store/tenant
   - Create default tenant if it doesn't exist
   - Backfill `storeId` columns with default tenant ID

2. **Handle orphaned data:**
   - Decide what to do with data that can't be assigned to a tenant
   - Create migration scripts to assign data

### Backward Compatibility

- Consider supporting both single-tenant and multi-tenant modes
- Use feature flags to enable multi-tenancy gradually
- Maintain backward compatibility for existing API consumers

### Performance Impact

- Database queries will need additional `WHERE` clauses
- Indexes on `storeId` columns are critical
- Consider query performance impact
- May need to optimize queries for multi-tenant scenarios

---

## Files Referenced

### Schema Files
- `packages/db/src/schema/stores.ts` - Store schema (no tenant isolation)
- `packages/db/src/schema/products.ts` - Missing `storeId`
- `packages/db/src/schema/orders.ts` - Missing `storeId`
- `packages/db/src/schema/customers.ts` - Missing `storeId`
- `packages/db/src/schema/webhooks.ts` - Has `storeId` (partial implementation)

### Service Files
- `apps/backend/src/modules/stores/stores.service.ts` - Single-tenant config pattern
- `apps/backend/src/modules/products/products.service.ts` - Uses `getDefaultStoreId()`
- `apps/backend/src/modules/customers/customers.service.ts` - Uses `getDefaultStoreId()`
- `apps/backend/src/modules/webhooks/services/webhook-delivery.service.ts` - Explicit single-tenant TODO

### Metrics & Observability
- `apps/backend/src/common/metrics/metrics.service.ts` - No tenant labels

### Permissions & Auth
- `apps/backend/src/modules/permissions/permissions.service.ts` - Global admin role
- `apps/backend/src/common/guards/permissions.guard.ts` - Global admin check
- `packages/db/src/schema/users.ts` - User roles schema
- `packages/db/src/schema/admin-roles.ts` - Admin roles schema

### Documentation
- `ROADMAP.md:167` - Multi-tenancy listed as future work

---

## Recommendations

### Short Term (If Multi-Tenancy is Needed Soon)

1. **Document current limitations** - This document serves that purpose
2. **Plan migration strategy** - Design tenant isolation approach
3. **Create proof of concept** - Implement tenant isolation for one module (e.g., products)
4. **Estimate effort** - Assess development time for full multi-tenancy

### Long Term (If Multi-Tenancy is Planned)

1. **Follow roadmap** - Implement multi-tenancy as planned in `ROADMAP.md`
2. **Incremental approach** - Add tenant isolation module by module
3. **Testing strategy** - Ensure tenant isolation is properly tested
4. **Performance monitoring** - Monitor query performance with tenant filtering

### Alternative: Stay Single-Tenant

If multi-tenancy is not required:
- Current architecture is fine for single deployment
- Multiple stores can coexist without isolation
- Simpler to maintain and operate
- Better performance (no tenant filtering overhead)

---

## Conclusion

The codebase is **not multi-tenant**. It implements **multi-store support** in a **single-tenant architecture**. 

To achieve true multi-tenancy, significant changes would be required across:
- Database schema (add `storeId` to all tables)
- Application code (tenant context propagation)
- Configuration management (per-tenant configs)
- Metrics & observability (tenant labels)
- Admin roles (tenant-scoped permissions)
- Infrastructure (tenant-aware routing)

The roadmap indicates multi-tenancy is planned for the future, but it is not currently implemented.
