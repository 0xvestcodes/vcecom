# Admin API Reference

The Admin API provides comprehensive management capabilities for the VCEcom platform. All endpoints require authentication with admin privileges and follow RESTful conventions.

## Authentication

### JWT Authentication
All admin endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt-token>
```

### Login
```http
POST /api/v1/admin/auth/login
Content-Type: application/json

{
  "email": "admin@vcecom.com",
  "password": "password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

## Product Management

### Create Product
```http
POST /api/v1/admin/products
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Wireless Bluetooth Headphones",
  "description": "High-quality wireless headphones with noise cancellation",
  "price": 2999.99,
  "gstRate": 18,
  "hsnCode": "8518.12.00",
  "status": "draft",
  "categoryId": "category-uuid"
}
```

**Response:**
```json
{
  "id": "product-uuid",
  "title": "Wireless Bluetooth Headphones",
  "description": "High-quality wireless headphones with noise cancellation",
  "price": 2999.99,
  "gstRate": 18,
  "hsnCode": "8518.12.00",
  "status": "draft",
  "categoryId": "category-uuid",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### List Products
```http
GET /api/v1/admin/products?page=1&limit=20&status=active&categoryId=category-uuid
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `status`: Filter by status (draft, active, archived)
- `categoryId`: Filter by category
- `search`: Search in title and description

**Response:**
```json
{
  "data": [
    {
      "id": "product-uuid",
      "title": "Wireless Bluetooth Headphones",
      "price": 2999.99,
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Update Product
```http
PATCH /api/v1/admin/products/{productId}
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Premium Wireless Bluetooth Headphones",
  "price": 3299.99,
  "status": "active"
}
```

### Delete Product
```http
DELETE /api/v1/admin/products/{productId}
Authorization: Bearer <token>
```

## Product Variants

### Create Variant
```http
POST /api/v1/admin/products/{productId}/variants
Content-Type: application/json
Authorization: Bearer <token>

{
  "sku": "PROD-001-SM-RED",
  "price": 2999.99,
  "inventory": 100,
  "size": "Small",
  "color": "Red",
  "weight": 0.5
}
```

**Response:**
```json
{
  "id": "variant-uuid",
  "productId": "product-uuid",
  "sku": "PROD-001-SM-RED",
  "price": 2999.99,
  "inventory": 100,
  "size": "Small",
  "color": "Red",
  "weight": 0.5,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Update Inventory
```http
PATCH /api/v1/admin/variants/{variantId}/inventory
Content-Type: application/json
Authorization: Bearer <token>

{
  "inventory": 150,
  "operation": "set"  // "set", "add", "subtract"
}
```

## Categories and Collections

### Create Category
```http
POST /api/v1/admin/categories
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Electronics",
  "description": "Electronic devices and accessories",
  "slug": "electronics",
  "parentId": null
}
```

### Create Collection
```http
POST /api/v1/admin/collections
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Summer Collection",
  "slug": "summer-collection",
  "description": "Trending summer products",
  "imageUrl": "https://example.com/summer-collection.jpg"
}
```

### Add Product to Collection
```http
POST /api/v1/admin/collections/{collectionId}/products/{productId}
Authorization: Bearer <token>
```

## Pricing Management

### Create Price List
```http
POST /api/v1/admin/price-lists
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "VIP Customer Pricing",
  "description": "Special pricing for VIP customers",
  "customerGroupId": "vip-group-uuid",
  "rules": [
    {
      "variantId": "variant-uuid",
      "price": 2499.99,
      "compareAtPrice": 2999.99
    }
  ],
  "isActive": true,
  "priority": 10
}
```

### Update Product Pricing
```http
PATCH /api/v1/admin/products/{productId}/pricing
Content-Type: application/json
Authorization: Bearer <token>

{
  "price": 2799.99,
  "compareAtPrice": 3299.99,
  "customerGroupOverrides": {
    "vip-group-uuid": 2499.99
  }
}
```

## Discount Management

### Create Discount
```http
POST /api/v1/admin/discounts
Content-Type: application/json
Authorization: Bearer <token>

{
  "code": "SAVE20",
  "type": "PERCENTAGE",
  "valueType": "PERCENTAGE",
  "value": 20,
  "applicationType": "MANUAL",
  "scope": "ORDER",
  "minOrderAmount": 1000,
  "usageLimit": 1000,
  "customerUsageLimit": 1,
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "isActive": true,
  "productIds": ["product-uuid-1", "product-uuid-2"],
  "categoryIds": ["category-uuid"]
}
```

### Update Discount
```http
PATCH /api/v1/admin/discounts/{discountId}
Content-Type: application/json
Authorization: Bearer <token>

{
  "usageLimit": 500,
  "isActive": false
}
```

## Bundle Management

### Create Bundle
```http
POST /api/v1/admin/bundles
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Gaming PC Build",
  "description": "Complete gaming PC build with all components",
  "isActive": true,
  "allowMixAndMatch": false
}
```

### Create Bundle Set
```http
POST /api/v1/admin/bundles/{bundleId}/sets
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Choose your CPU",
  "description": "Select one CPU from the available options",
  "minQuantity": 1,
  "maxQuantity": 1
}
```

### Add Items to Bundle Set
```http
POST /api/v1/admin/bundles/{bundleId}/sets/{setId}/items
Content-Type: application/json
Authorization: Bearer <token>

{
  "variantId": "variant-uuid",
  "quantity": 1,
  "isDefault": false,
  "sortOrder": 1
}
```

## Order Management

### List Orders
```http
GET /api/v1/admin/orders?page=1&limit=20&status=confirmed&customerId=customer-uuid
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `status`: Order status filter
- `customerId`: Filter by customer
- `orderNumber`: Search by order number
- `dateFrom`, `dateTo`: Date range filter

### Update Order Status
```http
PATCH /api/v1/admin/orders/{orderId}/status
Content-Type: application/json
Authorization: Bearer <token>

{
  "status": "shipped",
  "note": "Order shipped via BlueDart tracking: BD123456789"
}
```

### Process Refund
```http
POST /api/v1/admin/orders/{orderId}/refund
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount": 500,
  "reason": "Damaged product",
  "initiatePaymentRefund": true
}
```

## Customer Management

### List Customers
```http
GET /api/v1/admin/customers?page=1&limit=20&search=john@example.com
Authorization: Bearer <token>
```

### Update Customer
```http
PATCH /api/v1/admin/customers/{customerId}
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "John Smith",
  "phone": "+91-9876543210",
  "isActive": true
}
```

## Analytics & Reporting

### Order Analytics
```http
GET /api/v1/admin/analytics/orders?dateFrom=2024-01-01&dateTo=2024-01-31
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalOrders": 1250,
  "totalRevenue": 2500000,
  "averageOrderValue": 2000,
  "ordersByStatus": {
    "pending": 10,
    "confirmed": 50,
    "processing": 100,
    "shipped": 200,
    "delivered": 890
  },
  "revenueByDay": [
    {"date": "2024-01-01", "revenue": 50000},
    {"date": "2024-01-02", "revenue": 45000}
  ]
}
```

### Product Performance
```http
GET /api/v1/admin/analytics/products?dateFrom=2024-01-01&dateTo=2024-01-31
Authorization: Bearer <token>
```

**Response:**
```json
{
  "topProducts": [
    {
      "productId": "product-uuid",
      "title": "Wireless Headphones",
      "orders": 150,
      "revenue": 450000,
      "unitsSold": 150
    }
  ],
  "inventoryAlerts": [
    {
      "variantId": "variant-uuid",
      "sku": "PROD-001-SM-RED",
      "currentStock": 5,
      "threshold": 10
    }
  ]
}
```

## Inventory Management

### Inventory Overview
```http
GET /api/v1/admin/inventory/overview
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalVariants": 1250,
  "inStockVariants": 1100,
  "outOfStockVariants": 150,
  "lowStockVariants": 75,
  "totalValue": 5000000,
  "reservedInventory": {
    "total": 500,
    "byCart": 350,
    "byOrder": 150
  }
}
```

### Bulk Inventory Update
```http
POST /api/v1/admin/inventory/bulk-update
Content-Type: application/json
Authorization: Bearer <token>

{
  "updates": [
    {
      "variantId": "variant-uuid-1",
      "inventory": 100,
      "operation": "set"
    },
    {
      "variantId": "variant-uuid-2",
      "inventory": 50,
      "operation": "add"
    }
  ]
}
```

## System Management

### Health Check
```http
GET /api/v1/admin/health
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "external": {
      "razorpay": "healthy",
      "email": "healthy"
    }
  },
  "metrics": {
    "uptime": "5d 2h 30m",
    "memory": "256MB / 512MB",
    "activeConnections": 45
  }
}
```

### Cache Management
```http
POST /api/v1/admin/system/cache/clear
Content-Type: application/json
Authorization: Bearer <token>

{
  "pattern": "product:*",  // Optional: specific pattern to clear
  "confirm": true
}
```

### Database Maintenance
```http
POST /api/v1/admin/system/database/reconcile
Authorization: Bearer <token>
```

**Operations:**
- Reconcile inventory levels
- Fix orphaned records
- Update cached statistics
- Validate data consistency

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "price",
      "issue": "must be greater than 0"
    },
    "requestId": "req-1234567890",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Input validation failed
- `NOT_FOUND`: Resource not found
- `FORBIDDEN`: Insufficient permissions
- `CONFLICT`: Resource state conflict
- `RATE_LIMITED`: Too many requests
- `SERVICE_UNAVAILABLE`: External service failure

## Rate Limiting

Admin API endpoints are rate limited to prevent abuse:

- **General endpoints**: 100 requests per minute per admin
- **Bulk operations**: 10 requests per minute per admin
- **Analytics endpoints**: 30 requests per minute per admin

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642159200
```

## Webhooks

### Register Webhook
```http
POST /api/v1/admin/webhooks
Content-Type: application/json
Authorization: Bearer <token>

{
  "url": "https://example.com/webhooks/vcecom",
  "events": ["order.created", "order.shipped", "payment.succeeded"],
  "secret": "webhook-secret",
  "isActive": true
}
```

### Webhook Events
- `order.created`: New order placed
- `order.status_changed`: Order status updated
- `payment.succeeded`: Payment completed
- `payment.failed`: Payment failed
- `inventory.low_stock`: Inventory below threshold
- `product.created`: New product added

## API Versioning

The API uses URL-based versioning. The current version is v1:

```
https://api.vcecom.com/api/v1/admin/products
```

Future versions will be available at:
```
https://api.vcecom.com/api/v2/admin/products
```

## SDK & Libraries

### JavaScript/TypeScript SDK
```javascript
import { VCEcomAdmin } from '@vcecom/admin-sdk';

const client = new VCEcomAdmin({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.vcecom.com/api/v1'
});

// Create product
const product = await client.products.create({
  title: 'New Product',
  price: 99.99,
  status: 'active'
});

// List orders
const orders = await client.orders.list({
  status: 'confirmed',
  limit: 50
});
```

### cURL Examples
```bash
# Create product
curl -X POST https://api.vcecom.com/api/v1/admin/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sample Product",
    "price": 29.99,
    "status": "active"
  }'

# List orders
curl -X GET "https://api.vcecom.com/api/v1/admin/orders?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

This API reference covers the core admin functionality. For detailed request/response schemas and additional endpoints, refer to the OpenAPI specification or contact the development team.

## Interactive API Documentation

For complete API documentation with interactive testing, see:

- **[Admin API Interactive Docs](/api-reference/admin)** - Full OpenAPI specification with Redoc
- **OpenAPI JSON**: Available at `/api/docs-json` endpoint

The interactive documentation includes:
- Complete endpoint documentation
- Request/response schemas
- Try-it-out functionality
- Authentication examples
- All admin endpoints organized by tags

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response Format:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

See [Admin Pagination Documentation](/docs/admin/pagination) for details.