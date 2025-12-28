# Introduction

Welcome to VCEcom (Vestcodes Commerce), a lightweight and scalable ecommerce backend built with modern technologies. This documentation provides comprehensive guidance for developers working with the VCEcom platform.

## What is VCEcom?

VCEcom is a full-featured ecommerce backend that provides:

- **Product Catalog Management**: Flexible product, variant, and collection management
- **Advanced Pricing Engine**: Dynamic pricing with customer groups and price lists
- **Discount Engine**: Complex discount rules with stacking and priority management
- **Bundle System**: Product bundles with configurable choice sets
- **Checkout System**: Atomic checkout with inventory locking and payment processing
- **Order Management**: Complete order lifecycle from creation to fulfillment
- **Review System**: Verified purchase reviews with moderation and aggregation
- **Observability**: Comprehensive logging, tracing, and monitoring

## Architecture Overview

VCEcom is built as a **Turborepo monorepo** using **pnpm workspaces**, enabling efficient code sharing and parallel development. The architecture consists of multiple applications and shared packages:

```mermaid
graph TB
    subgraph "Monorepo Workspace"
        A[Next.js Storefront] --> B[NestJS Backend API]
        C[Admin Dashboard] --> B
        D[Documentation] 
        
        subgraph "Shared Packages"
            E[@vcecom/db<br/>Database Schema]
            F[@vcecom/typescript-config<br/>TypeScript Configs]
        end
        
        B --> E
        A --> E
        C --> E
    end
    
    B --> G[PostgreSQL Database]
    B --> H[Redis Cache]
    B --> I[Razorpay Payments]
    B --> J[Email/SMS Services]

    subgraph "Backend Modules"
        K[Authentication]
        L[Products]
        M[Pricing]
        N[Discounts]
        O[Bundles]
        P[Checkout]
        Q[Orders]
        R[Reviews]
        S[Observability]
    end

    B --> K
    B --> L
    B --> M
    B --> N
    B --> O
    B --> P
    B --> Q
    B --> R
    B --> S
```

**Monorepo Benefits**:
- **Shared Database Schema**: Single source of truth via `@vcecom/db` package
- **Type Safety**: Consistent types across frontend and backend
- **Fast Builds**: Turborepo caching and parallel execution
- **Code Reuse**: Shared utilities and configurations
- **Independent Deployment**: Each app deployed separately

For detailed information about the monorepo structure, see [Monorepo Architecture](../architecture/monorepo.md).

## Core Technologies

### Backend Framework
- **NestJS**: Progressive Node.js framework for building efficient, scalable applications
- **TypeScript**: Type-safe development with modern JavaScript features

### Database & Caching
- **PostgreSQL**: Robust relational database with Drizzle ORM
- **Redis**: High-performance caching and session management
- **Drizzle ORM**: Type-safe database operations

### Business Logic
- **Pricing Engine**: Customer-specific pricing with rule-based calculations
- **Discount Engine**: Flexible discount rules with stacking and priority
- **Bundle Engine**: Configurable product bundles with choice sets

### Infrastructure
- **Docker**: Containerized deployment
- **OpenTelemetry**: Distributed tracing and observability
- **Pino**: High-performance structured logging

## Key Features

### 🛍️ **Product Management**
- Hierarchical product catalog with variants
- Flexible categorization and collections
- Inventory tracking with reservations

### 💰 **Dynamic Pricing**
- Customer group-based pricing
- Price lists with override capabilities
- Real-time pricing calculations

### 🏷️ **Advanced Discounts**
- Multiple discount types (percentage, fixed amount, buy-get)
- Rule stacking with configurable priority
- Time-based and usage-limited discounts

### 📦 **Product Bundles**
- Configurable bundle definitions
- Choice sets with min/max quantities
- Dynamic bundle pricing

### 🛒 **Checkout System**
- Atomic checkout with state machine
- Inventory locking and reservation
- Multi-gateway payment support

### 📋 **Order Processing**
- Complete order lifecycle management
- Inventory consumption and reconciliation
- Multi-channel fulfillment support

### ⭐ **Review System**
- Verified purchase reviews
- Automated content moderation
- Review aggregation and analytics

### 📊 **Observability**
- Structured logging with correlation
- Distributed tracing with OpenTelemetry
- Performance monitoring and alerting

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker (optional)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/Vestcodes/vcecom.git
cd vcecom

# Install dependencies (installs for all workspaces)
pnpm install

# Set up environment
cp .env.example .env
# Configure your database and Redis connections

# Run database migrations (from packages/db)
pnpm --filter @vcecom/db db:migrate

# Start all apps in development mode (parallel)
pnpm dev

# Or start specific apps:
# Backend only
pnpm --filter @vestcodes/vcecom-backend dev

# Admin dashboard only
pnpm --filter @vestcodes/vcecom-admin dev

# Storefront only
pnpm --filter @vestcodes/vcecom-storefront dev

# Documentation only
pnpm --filter @vestcodes/vcecom-docs dev
```

### Development Workflow

**Monorepo Commands**:
```bash
# Run tasks across all workspaces
turbo run build          # Build all apps and packages
turbo run check-types    # Type-check all workspaces
turbo run lint           # Lint all workspaces

# Run tasks for specific workspace
turbo run build --filter=admin
turbo run build --filter=backend

# Run tasks for workspace and dependencies
turbo run build --filter=admin^...
```

**Workflow Steps**:
1. **Database Changes**: Update schema in `packages/db`, generate migrations
2. **Backend Development**: NestJS with hot reload, uses `@vcecom/db` package
3. **Frontend Development**: Next.js apps with hot reload, consume backend API
4. **Testing**: Jest with full test coverage, run per workspace
5. **Documentation**: Docusaurus for comprehensive docs, auto-updates on changes

**Key Principles**:
- **Shared Packages**: Database schema and types shared via `@vcecom/db`
- **Workspace Dependencies**: Use `workspace:*` protocol for internal packages
- **Parallel Execution**: Turborepo runs independent tasks in parallel
- **Intelligent Caching**: Build outputs cached for faster rebuilds

## API Architecture

VCEcom provides two primary API interfaces:

### Admin API
- **Authentication**: JWT-based admin authentication
- **CRUD Operations**: Full management of products, orders, customers
- **Business Logic**: Pricing, discounts, inventory management
- **Analytics**: Reporting and business intelligence

### Storefront API
- **Product Browsing**: Catalog search and filtering
- **Cart Management**: Session-based shopping carts
- **Checkout**: Guest and authenticated checkout flows
- **Customer Accounts**: Profile management and order history

## Security & Compliance

### Authentication & Authorization
- JWT-based authentication for both admin and storefront
- Role-based access control (RBAC)
- API key authentication for external integrations

### Data Protection
- Sensitive data redaction in logs
- TLS encryption for data in transit
- Secure credential management

### Compliance
- GDPR-compliant data handling
- PCI DSS compliant payment processing
- Audit trails for all business operations

## Performance & Scalability

### Caching Strategy
- Multi-layer Redis caching (operational, application, session)
- Intelligent cache invalidation with TTL management
- Background cache warming and refresh

### Database Optimization
- Optimized queries with proper indexing
- Connection pooling and prepared statements
- Read replicas for high-traffic scenarios

### Horizontal Scaling
- Stateless application design
- Redis Cluster for cache scaling
- Database read replicas and sharding

## Monitoring & Observability

### Metrics & Alerting
- Application performance metrics
- Business KPI tracking
- Error rate and latency monitoring
- Automated alerting and incident response

### Logging & Tracing
- Structured JSON logging with correlation IDs
- Distributed tracing across all services
- Request context propagation
- Performance profiling and bottleneck identification

## Contributing

We welcome contributions to VCEcom! Please see our contributing guidelines:

- **Issues**: Report bugs and request features
- **Pull Requests**: Submit code changes with tests
- **Documentation**: Help improve our documentation
- **Discussions**: Join community discussions

### Development Setup
```bash
# Fork the repository
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes with tests
# Run the test suite
pnpm test

# Submit a pull request
```

## Support & Community

### Documentation
- **API Reference**: Complete API documentation with examples
- **Guides**: Step-by-step tutorials and best practices
- **Architecture**: Deep dives into system design and patterns

### Getting Help
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: General questions and community support
- **Discord**: Real-time chat with the community

### Enterprise Support
For enterprise deployments and commercial support:
- **Professional Services**: Implementation and consulting
- **Training**: Team training and knowledge transfer
- **SLA Support**: 24/7 support with guaranteed response times

---

VCEcom is designed to be both powerful and developer-friendly, providing the foundation for modern ecommerce applications while maintaining the flexibility to adapt to unique business requirements.