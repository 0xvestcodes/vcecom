# VCEcom - AI-Powered Ecommerce Builder & Agency Accelerator

> Built with ❤️ by [Vestcodes](https://vestcodes.co)

A production-ready, India-first ecommerce platform that can evolve into a **SaaS AI ecommerce builder** and **agency accelerator**. Built specifically for the Indian market with deep GST integration, Razorpay payments, and seamless shipping provider integrations.

## 🎯 What is VCEcom?

VCEcom is a complete ecommerce solution designed to evolve into a **SaaS platform** that empowers agencies and businesses to build online stores faster with AI-powered tools. It's designed from the ground up for the Indian market, with native GST compliance, Indian payment gateways, and local shipping providers built right in.

**Vision:**
- **SaaS Evolution**: Platform designed to evolve into a hosted SaaS solution
- **AI Ecommerce Builder**: AI-powered tools for building stores, generating content, and automating workflows
- **Agency Accelerator**: Tools and features that help agencies build and manage multiple client stores efficiently

**Perfect for:**
- **Agencies** building ecommerce stores for multiple clients
- **E-commerce businesses** targeting the Indian market
- **D2C brands** looking for a complete commerce solution
- **Developers** building custom storefronts with AI assistance
- **Businesses** needing GST-compliant invoicing and Indian integrations

## ✨ Key Features

### 🇮🇳 India-First Design

- **Native GST Compliance**: Automatic CGST/SGST/IGST calculation integrated into cart and orders
- **Advanced Tax Engine**: 
  - Tax rule overrides at multiple levels (Customer Group, Customer, Category, Product, Variant)
  - Tax exemptions with certificate tracking
  - B2B vs B2C pricing differentiation (configurable per customer group)
  - HSN code management and validation (8-digit format)
  - Dynamic GST rate resolution with priority-based rule matching
  - Comprehensive tax audit logs for compliance
- **GST Invoice Generation**: PDF invoices with complete GST breakdown
- **GSTIN Validation**: Format and structure validation for business GST numbers
- **Indian Address Validation**: PIN code validation, state/district autocomplete
- **Phone Number Support**: 10-digit Indian phone number validation and normalization

### 💳 Payment Processing

- **Razorpay Integration**: Full integration with India's leading payment gateway
- **Multiple Payment Methods**: UPI, Cards, Net Banking, Wallets, and more
- **Cash on Delivery**: COD support for Indian market
- **Secure Processing**: PCI-compliant payment handling with webhooks
- **Payment Tracking**: Complete payment history and status tracking

### 💱 Multi-Currency System

- **FX Rate Management**: Automatic exchange rate fetching from multiple providers (ExchangeRate-API, Fixer.io, CurrencyLayer)
- **Rate Caching**: Redis-backed caching for exchange rates (1-hour TTL, configurable)
- **Currency Conversion**: Automatic price conversion based on customer's selected currency
- **Price List Overrides**: Currency-specific pricing for different markets
- **Admin Currency Management**: Full CRUD interface for managing currencies
- **Store & Variant Currency Support**: Hybrid approach supporting store base currency and per-variant currencies

### 🔗 Webhooks System

- **Outgoing Webhooks**: Real-time notifications for order, product, and customer events
- **Incoming Webhooks**: Support for payment and shipping provider webhooks
- **Reliable Delivery**: BullMQ-powered queue with exponential backoff retry
- **Webhook Signing**: HMAC-SHA256 signature verification for security
- **Delivery Logs**: Complete audit trail of all webhook deliveries
- **Admin Management**: Full webhook configuration and testing interface

### ⚙️ Job Queue Infrastructure

- **BullMQ Integration**: Redis-backed job queue system for reliable background processing
- **Scheduled Jobs**: Cron-based job scheduling with automatic enqueueing
- **Dead-Letter Queue**: Automatic handling of failed jobs that exceed retry limits
- **Retry Strategy**: Configurable exponential backoff retry mechanism
- **Worker Monitoring**: Comprehensive admin panel for queue monitoring and management
- **Queue Management**: Pause/resume queues, retry failed jobs, and remove jobs
- **Job Processors**: Extensible processor system for different job types

### 📦 Shipping & Fulfillment

- **Shiprocket Integration**: Seamless integration with Shiprocket for shipping
- **Nimbus Post Integration**: Alternative shipping provider support
- **Rate Calculation**: Real-time shipping rates based on PIN codes
- **Label Generation**: Automatic shipping label creation
- **Order Tracking**: Real-time tracking updates for customers

### 🛍️ Complete Commerce Features

- **Product Catalog**: Full product management with variants, images, and options
- **Shopping Cart**: Real-time cart calculations with GST and dynamic tax resolution
- **Order Management**: Complete order lifecycle with status tracking
- **Customer Management**: Customer profiles, addresses, and order history
- **Discount System**: Flexible discount codes and promotions
- **Tax Management**: Advanced tax engine with rules, exemptions, and HSN code management
- **Search & Filtering**: Advanced product search and filtering
- **Admin Dashboard**: Comprehensive admin interface for managing your store

### 🖼️ Advanced Media Pipeline

- **Multi-Size Image Generation**: Automatic generation of thumbnail, small, medium, large, and original sizes
- **Modern Format Support**: WebP and AVIF format generation with automatic fallback
- **CDN Optimization**: Cache-Control headers and ETag support for optimal CDN performance
- **Cache Busting**: Content hash-based cache busting for immutable URLs
- **Signed URLs**: Secure signed URLs for private media downloads
- **Multi-Bucket Architecture**: Separate buckets for product-media, uploads, and internal files
- **Responsive Images**: Frontend components with automatic format and size selection

### 🤖 AI-Powered Features (Coming Soon)

- **AI Store Builder**: Generate complete stores with AI assistance
- **Product Description Generator**: AI-powered product descriptions
- **Content Generation**: Automated content creation for products and pages
- **Smart Recommendations**: AI-driven product recommendations
- **Automated Workflows**: AI-powered automation for common tasks

### 🚀 Agency Tools (Coming Soon)

- **Multi-Store Management**: Manage multiple client stores from one dashboard
- **White-Label Options**: Brand the platform for your agency
- **Client Onboarding**: Streamlined client setup workflows
- **Template Library**: Pre-built store templates for faster deployment
- **Bulk Operations**: Manage multiple stores efficiently

### 🔒 Enterprise-Grade

- **Type-Safe**: Built with TypeScript for reliability
- **Scalable Architecture**: Designed to handle growth and multi-tenancy
- **Security**: Enterprise-grade security practices
- **Audit Logging**: Complete audit trail of all operations
- **API-First**: RESTful API for custom integrations

## 🏗️ Architecture

VCEcom is built as a **headless commerce platform** with SaaS evolution in mind, meaning you get:

- **Backend API**: Complete REST API for all commerce operations
- **Admin Dashboard**: Ready-to-use admin interface
- **Multi-Tenancy Ready**: Architecture designed for SaaS deployment
- **Flexibility**: Build custom storefronts using the API
- **Modern Stack**: Built with NestJS, Next.js, and PostgreSQL

### Tech Stack

- **Backend**: NestJS - Enterprise Node.js framework
- **Database**: PostgreSQL with Drizzle ORM
- **Admin UI**: Next.js with shadcn/ui components
- **Language**: TypeScript throughout
- **Infrastructure**: Docker-ready, cloud-deployable, SaaS-ready

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- PostgreSQL database
- Redis (for caching and job queues)
- FX Provider API Key (optional, for multi-currency support)

### Installation

```bash
# Clone the repository
git clone https://github.com/vestcodes/vcecom.git
cd vcecom

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
cd packages/db
pnpm db:migrate:run

# Seed default data (including currencies)
pnpm db:seed

# Start development servers
cd ../..
pnpm dev
```

### Multi-Currency Configuration

To enable multi-currency support, configure your FX provider:

```bash
# Set FX provider (exchange-rate-api, fixer-io, or currencylayer)
FX_PROVIDER=exchange-rate-api

# Set your FX provider API key
FX_PROVIDER_API_KEY=your_api_key_here

# Optional: Configure cache TTL (default: 3600 seconds)
FX_CACHE_TTL=3600
```

**Supported FX Providers:**
- **ExchangeRate-API**: Free tier available at https://www.exchangerate-api.com/
- **Fixer.io**: https://fixer.io/
- **CurrencyLayer**: https://currencylayer.com/

### Docker Setup

Start PostgreSQL and Redis using Docker:

```bash
docker-compose -f docker-compose.dev.yaml up -d
```

## 📚 Documentation

Comprehensive documentation is available covering:

- **API Reference**: Complete API documentation
- **Architecture Guide**: System architecture and design decisions
- **Integration Guides**: Payment, shipping, and third-party integrations
- **Deployment Guide**: Production deployment instructions
- **GST Guide**: GST calculation and compliance details
- **Agency Guide**: Tools and workflows for agencies

Visit our [documentation site](https://vestcodes.github.io/vcecom) for detailed guides.

## 🎯 Use Cases

### Agencies & Developers
Build and manage multiple client stores efficiently with AI-powered tools, white-label options, and streamlined workflows.

### E-commerce Stores
Build complete online stores with product catalogs, shopping carts, and checkout flows optimized for Indian customers.

### D2C Brands
Perfect for direct-to-consumer brands needing GST-compliant invoicing, Indian payment methods, and local shipping.

### SaaS Evolution
The platform is architected to evolve into a hosted SaaS solution, making it perfect for agencies looking to offer their own ecommerce platform.

### Custom Storefronts
Use the headless API to build custom storefronts while leveraging all commerce features through the API.

## 🔧 Integration Examples

### Payment Integration
```typescript
// Create Razorpay order
const order = await createRazorpayOrder({
  amount: 10000, // ₹100.00
  currency: 'INR',
  receipt: 'order_123'
});
```

### Shipping Integration
```typescript
// Calculate shipping rates
const rates = await calculateShipping({
  pincode: '110001',
  weight: 500, // grams
  cod: true
});
```

### GST Calculation
```typescript
// Automatic GST calculation
const cart = await calculateCart({
  items: [...],
  shippingAddress: {
    pincode: '110001',
    state: 'Delhi'
  }
});
// Returns: subtotal, CGST, SGST, IGST, total
```

### Webhooks Integration
```typescript
// Configure webhook endpoint
POST /admin/webhooks
{
  "name": "Order Notifications",
  "url": "https://your-app.com/webhooks/orders",
  "events": ["order.created", "order.shipped", "order.delivered"],
  "secret": "your-webhook-secret"
}

// Verify webhook signature
const signature = headers['x-webhook-signature'];
const isValid = verifyWebhookSignature(payload, signature, secret);
```

## 📊 What's Included

### Backend API
- ✅ Product catalog management
- ✅ Shopping cart operations
- ✅ Order processing
- ✅ Customer management
- ✅ Payment processing
- ✅ Shipping integration
- ✅ GST calculation
- ✅ Discount system
- ✅ Search and filtering
- ✅ Advanced search infrastructure (Meilisearch, Elasticsearch, OpenSearch)
- ✅ Search indexer for products, collections, and variants
- ✅ Incremental indexing with real-time updates
- ✅ Background reindex workers
- ✅ Search relevance tuning (field weights, boost factors, synonyms, stop words)
- ✅ Search performance metrics and monitoring
- ✅ Webhooks system (outgoing + incoming)
- ✅ Job queue infrastructure (BullMQ)
- ✅ Scheduled jobs and cron tasks
- ✅ Dead-letter queue handling
- ✅ Retry with exponential backoff
- ✅ Advanced media pipeline with multi-size generation
- ✅ WebP/AVIF format support with automatic fallback
- ✅ CDN-optimized caching headers
- ✅ Cache busting with content hashing
- ✅ Signed URLs for secure media access
- ✅ Multi-bucket storage architecture
- ✅ Multi-currency system with FX rate management
- ✅ Currency conversion and caching
- ✅ Currency-specific price list overrides
- ✅ Customer wallet system (store credits)
- ✅ Loyalty points system with earning/redemption rules
- ✅ Wallet transaction ledger
- ✅ Admin wallet management interface
- ✅ Loyalty rules configuration
- ✅ Automatic points earning on order completion
- ✅ Wallet refunds option

### Admin Dashboard
- ✅ Product management UI
- ✅ Order management UI
- ✅ Customer management
- ✅ Dashboard analytics
- ✅ Settings and configuration
- ✅ Webhook management interface
- ✅ Job queue monitoring and management
- ✅ Queue statistics and metrics
- ✅ Dead-letter queue management
- ✅ Search index management and monitoring
- ✅ Search reindex operations
- ✅ Search relevance configuration
- ✅ Currency management interface
- ✅ FX rate configuration and monitoring
- ✅ Wallet management interface
- ✅ Loyalty rules management
- ✅ Customer wallet details and transaction history

### Developer Tools
- ✅ TypeScript types
- ✅ API documentation
- ✅ Development tools
- ✅ Testing utilities

### Coming Soon
- 🔄 AI-powered store builder
- 🔄 Multi-store management
- 🔄 Agency dashboard
- 🔄 White-label options
- 🔄 Template library
- 🔄 Storefront currency selector UI

## 🛣️ Roadmap

See our [Roadmap](./ROADMAP.md) for upcoming features and development plans.

**Current Focus:**
- Production hardening
- AI-powered features
- Agency tools and multi-store management
- SaaS infrastructure and multi-tenancy

## 🤝 Community

### Get Help
- 📖 [Documentation](https://vestcodes.github.io/vcecom)
- 💬 [GitHub Discussions](https://github.com/vestcodes/vcecom/discussions)
- 🐛 [Report Issues](https://github.com/vestcodes/vcecom/issues)

### Stay Updated
- ⭐ Star the repository to stay updated
- 📝 Check the [Changelog](./CHANGELOG.md) for latest releases
- 🗺️ Review the [Roadmap](./ROADMAP.md) for upcoming features

## 🎯 Vision & Evolution

VCEcom is designed to evolve into:

1. **SaaS Platform**: Hosted solution for agencies and businesses
2. **AI Ecommerce Builder**: AI-powered tools for faster store creation
3. **Agency Accelerator**: Tools that help agencies scale their ecommerce business

The architecture is built with multi-tenancy, scalability, and SaaS deployment in mind from day one.

## 📄 License

See [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

Built by [Vestcodes](https://vestcodes.co) - Transforming ideas into exceptional digital products.

---

<div align="center">

**Built by [Vestcodes](https://vestcodes.co)** - Transforming ideas into exceptional digital products

[Website](https://vestcodes.co) • [GitHub](https://github.com/vestcodes) • [LinkedIn](https://linkedin.com/company/vestcodes)

© 2025 Vestcodes. All rights reserved.

</div>
