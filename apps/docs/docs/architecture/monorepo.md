# Monorepo Architecture & Philosophy

VCEcom is built as a **Turborepo monorepo** using **pnpm workspaces**, following modern monorepo best practices for scalable, maintainable, and efficient development workflows.

## Monorepo Structure

```
vcecom/
├── apps/                    # Application workspaces
│   ├── admin/              # Next.js Admin Dashboard
│   ├── backend/            # NestJS Backend API
│   ├── storefront/         # Next.js Storefront
│   └── docs/               # Docusaurus Documentation
├── packages/                # Shared package workspaces
│   ├── db/                 # Shared database package (@vcecom/db)
│   └── typescript-config/  # Shared TypeScript configs
├── turbo.json              # Turborepo pipeline configuration
├── pnpm-workspace.yaml     # pnpm workspace configuration
└── package.json            # Root package.json
```

## Workspace Organization

### Applications (`apps/`)

Applications are independent deployable units:

#### **Admin Dashboard** (`apps/admin`)
- **Framework**: Next.js 16 with App Router
- **UI Library**: shadcn/ui components with Radix UI
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS v4
- **Purpose**: Complete admin interface for managing products, orders, customers, and store settings

#### **Backend API** (`apps/backend`)
- **Framework**: NestJS 11
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Redis (ioredis)
- **Purpose**: RESTful API backend with modular architecture

#### **Storefront** (`apps/storefront`)
- **Framework**: Next.js 16 with App Router
- **UI Library**: shadcn/ui components
- **State Management**: TanStack Query
- **Purpose**: Customer-facing ecommerce storefront

#### **Documentation** (`apps/docs`)
- **Framework**: Docusaurus 3
- **Purpose**: Comprehensive documentation site

### Shared Packages (`packages/`)

Shared packages provide reusable code and configurations:

#### **Database Package** (`packages/db`)
- **Name**: `@vcecom/db`
- **Purpose**: Shared database schema, migrations, and types
- **Technology**: Drizzle ORM, PostgreSQL
- **Exports**:
  - Schema definitions (`./schema`)
  - Database client and utilities
  - Type-safe database operations

```typescript
// Usage in apps
import { db } from '@vcecom/db';
import { products } from '@vcecom/db/schema';
```

#### **TypeScript Config** (`packages/typescript-config`)
- **Purpose**: Shared TypeScript configurations
- **Configs**: Base, Next.js, React Library configs
- **Usage**: Extended by apps for consistent type checking

## Turborepo Configuration

### Pipeline Tasks

Turborepo orchestrates tasks across workspaces with intelligent caching and parallel execution:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "check-types": {
      "dependsOn": ["^build", "^check-types"]
    }
  }
}
```

### Task Dependencies

- **`^build`**: Build all dependencies first (upstream workspaces)
- **`^check-types`**: Type-check dependencies before current workspace
- **Parallel Execution**: Independent tasks run in parallel
- **Caching**: Build outputs cached for faster subsequent builds

### Caching Strategy

Turborepo caches task outputs based on:
- **Inputs**: Source files, environment variables
- **Outputs**: Build artifacts, compiled code
- **Cache Keys**: Content hash of inputs

**Benefits**:
- Faster CI/CD pipelines
- Instant local rebuilds for unchanged code
- Efficient incremental builds

## Package Management

### pnpm Workspaces

**Workspace Protocol**: Internal dependencies use `workspace:*` protocol

```json
{
  "dependencies": {
    "@vcecom/db": "workspace:*",
    "@vcecom/typescript-config": "workspace:*"
  }
}
```

**Benefits**:
- Single source of truth for internal packages
- Automatic linking between workspaces
- Consistent versioning across monorepo

### Dependency Management Philosophy

1. **Shared Dependencies**: Common dependencies (React, TypeScript) hoisted to root
2. **Workspace Dependencies**: Internal packages use `workspace:*`
3. **Version Consistency**: Same versions across workspaces where possible
4. **Minimal Dependencies**: Each workspace only includes what it needs

## Development Workflow

### Starting Development

```bash
# Install all dependencies (root + all workspaces)
pnpm install

# Run dev for all apps in parallel
pnpm dev

# Run dev for specific workspace
pnpm --filter @vestcodes/vcecom-admin dev

# Run task across all workspaces
turbo run build

# Run task for specific workspace
turbo run build --filter=admin
```

### Building

```bash
# Build all workspaces (respects dependencies)
turbo run build

# Build specific workspace and its dependencies
turbo run build --filter=admin^...

# Build only changed workspaces
turbo run build --filter=...[origin/main]
```

### Type Checking

```bash
# Type-check all workspaces
turbo run check-types

# Type-check specific workspace
turbo run check-types --filter=backend
```

## Architecture Philosophy

### 1. Separation of Concerns

**Applications** are independent and deployable:
- Each app has its own `package.json`, build config, and deployment
- Apps can be developed, tested, and deployed independently
- Clear boundaries between frontend and backend

**Packages** provide shared functionality:
- Database schemas and types shared across backend
- TypeScript configs ensure consistency
- Future: Shared UI components, utilities, types

### 2. Code Reuse & DRY

- **Database Schema**: Single source of truth in `@vcecom/db`
- **Type Safety**: Shared types prevent inconsistencies
- **Configurations**: Shared configs ensure consistency

### 3. Scalability

- **Independent Scaling**: Each app can scale independently
- **Parallel Development**: Teams can work on different apps simultaneously
- **Selective Deployment**: Deploy only what changed

### 4. Developer Experience

- **Fast Builds**: Turborepo caching speeds up builds
- **Type Safety**: Shared types catch errors early
- **Hot Reload**: Each app supports hot reload independently
- **Single Command**: `pnpm dev` starts everything needed

## Build Philosophy

### Clean Code Principles

Following clean code guidelines (`apps/backend/CLEAN_CODE_GUIDELINES.md`):

1. **Small Functions**: Functions < 20 lines (max 50)
2. **Single Responsibility**: Each function/class does one thing
3. **Descriptive Names**: Self-documenting code
4. **No Magic Numbers**: Use constants
5. **Dependency Injection**: Never create dependencies directly
6. **Polymorphism over Conditionals**: Use strategy pattern

### Engine Pattern

Pure, deterministic engines for complex calculations:

```typescript
// Pure function - no side effects
interface PricingEngine {
  calculatePrice(
    variantId: string,
    customerId: string,
    context: PricingContext
  ): PriceResult;
}
```

**Principles**:
- Same input → same output (deterministic)
- No database/Redis access
- All data pre-fetched
- Easy to test

### Modular Design

- **Feature Modules**: Each feature is a self-contained module
- **Service Extraction**: Large services broken into focused services
- **Dependency Injection**: Loose coupling through DI
- **Interface Segregation**: Clear contracts between modules

## Workspace Dependencies

### Dependency Graph

```mermaid
graph TD
    Admin[Admin App] --> DB[@vcecom/db]
    Backend[Backend App] --> DB
    Storefront[Storefront App] --> DB
    
    Admin --> TSConfig[@vcecom/typescript-config]
    Backend --> TSConfig
    Storefront --> TSConfig
    Docs[Docs App] --> TSConfig
    
    Backend --> Admin[via API]
    Backend --> Storefront[via API]
```

### Internal Dependencies

**`@vcecom/db`** used by:
- `apps/backend` - Database operations
- Future: `apps/admin` - Type-safe API calls
- Future: `apps/storefront` - Type-safe API calls

**`@vcecom/typescript-config`** used by:
- All apps for consistent TypeScript configuration

## CI/CD Integration

### Turborepo in CI/CD

```yaml
# Example GitHub Actions
- name: Build
  run: turbo run build

- name: Type Check
  run: turbo run check-types

- name: Test
  run: turbo run test
```

**Benefits**:
- **Caching**: CI builds benefit from Turborepo cache
- **Parallel Execution**: Tests/builds run in parallel
- **Selective Execution**: Only run tasks for changed workspaces

### Deployment Strategy

1. **Independent Deployment**: Each app deployed separately
2. **Shared Packages**: Built once, used by all apps
3. **Versioning**: Shared packages versioned independently
4. **Rollback**: Rollback individual apps without affecting others

## Best Practices

### 1. Workspace Boundaries

- **Don't**: Import from other apps directly
- **Do**: Use shared packages for common code
- **Do**: Communicate via APIs between apps

### 2. Package Exports

- **Explicit Exports**: Only export what's needed
- **Type Exports**: Export TypeScript types
- **Versioning**: Version shared packages independently

### 3. Dependency Management

- **Hoisting**: Let pnpm handle dependency hoisting
- **Peer Dependencies**: Use peer dependencies for shared libraries
- **Workspace Protocol**: Always use `workspace:*` for internal packages

### 4. Build Optimization

- **Outputs**: Define clear outputs for caching
- **Inputs**: Include all relevant inputs in task config
- **Dependencies**: Define proper task dependencies

## Future Enhancements

### Planned Shared Packages

1. **`@vcecom/ui`**: Shared UI components
2. **`@vcecom/types`**: Shared TypeScript types
3. **`@vcecom/utils`**: Shared utility functions
4. **`@vcecom/api-client`**: Type-safe API client

### Multi-Tenancy Support

- **Tenant Isolation**: Workspace-level tenant isolation
- **Shared Infrastructure**: Common services across tenants
- **SaaS Evolution**: Architecture ready for SaaS deployment

## Summary

VCEcom's monorepo architecture provides:

✅ **Scalability**: Independent apps and shared packages  
✅ **Developer Experience**: Fast builds, type safety, hot reload  
✅ **Code Reuse**: Shared database schemas and types  
✅ **Efficiency**: Turborepo caching and parallel execution  
✅ **Maintainability**: Clear boundaries and separation of concerns  
✅ **Flexibility**: Independent deployment and scaling  

This architecture supports the evolution from a single-tenant application to a multi-tenant SaaS platform while maintaining code quality and developer productivity.
